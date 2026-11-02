import type { XlsxSheet } from "@/lib/xlsx/read-xlsx";

export type FieldOwnership = "HNA" | "Club" | "";

export type FieldTerminal = {
  clubId: string;
  club: string;
  terminalId: string;
  /** Terminal type exactly as exported. */
  type: string;
  ownership: FieldOwnership;
};

export type ParsedFieldExport = {
  sheetName: string;
  /** `YYYY-MM-DD` taken from the export sheet name (e.g. `14102025_154130_terminal_report`), when present. */
  exportDate: string | null;
  terminals: FieldTerminal[];
};

const HEADERS = {
  clubId: /^club\s*id$/i,
  club: /^club(\s*name)?$/i,
  terminalId: /^terminal\s*id$/i,
  type: /^terminal\s*type$/i,
  ownership: /^ownership(\s*type)?$/i,
} as const;

/** Finds the terminal-level sheet by its headers, so newer exports with re-ordered columns still read. */
export function parseFieldExport(sheets: XlsxSheet[]): ParsedFieldExport {
  for (const sheet of sheets) {
    const headerIndex = sheet.rows.findIndex((row) => row.some((c) => HEADERS.terminalId.test(c)));
    if (headerIndex < 0) continue;
    const header = sheet.rows[headerIndex];
    const col = Object.fromEntries(
      Object.entries(HEADERS).map(([key, re]) => [key, header.findIndex((c) => re.test(c ?? ""))])
    ) as Record<keyof typeof HEADERS, number>;
    if (col.terminalId < 0 || col.type < 0 || col.club < 0) continue;
    const terminals: FieldTerminal[] = [];
    for (const row of sheet.rows.slice(headerIndex + 1)) {
      const terminalId = row[col.terminalId]?.trim();
      if (!terminalId) continue;
      const owner = (col.ownership >= 0 ? row[col.ownership] : "")?.trim().toLowerCase() ?? "";
      terminals.push({
        clubId: col.clubId >= 0 ? (row[col.clubId] ?? "").trim() : "",
        club: (row[col.club] ?? "").trim(),
        terminalId,
        type: (row[col.type] ?? "").trim(),
        ownership: owner === "hna" ? "HNA" : owner === "club" ? "Club" : "",
      });
    }
    const date = /^(\d{2})(\d{2})(\d{4})_/.exec(sheet.name);
    return {
      sheetName: sheet.name,
      exportDate: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
      terminals,
    };
  }
  throw new Error("No sheet with a Terminal ID column was found in the field export");
}

const BLANK = /^(n\/?a|empty|none|unknown|-)?$/i;

/**
 * One name per model for comparing the export with the register. Lenovo M810z and 10Q0 stay separate,
 * and an NUC is counted once whichever screen it was supplied with.
 */
export function modelFamily(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (BLANK.test(s)) return "Model not recorded";
  return knownFamily(s) ?? s;
}

function knownFamily(s: string): string | null {
  if (/m810z/i.test(s)) return "Lenovo M810z";
  if (/10q0/i.test(s)) return "Lenovo 10Q0";
  if (/ps-?3316/i.test(s)) return "Posiflex PS-3316";
  if (/x22s|mst6376/i.test(s)) return "Mecer X22S";
  if (/nuc7cjyh|nuc7jyh/i.test(s)) return "Intel NUC7CJYH";
  const dell = /(?:dell|optiplex)\D*(3050|5270|7440|7450)/i.exec(s);
  if (dell) return `Dell OptiPlex ${dell[1]}`;
  if (/eliteone\s*800/i.test(s)) return "HP EliteOne 800";
  if (/(hp|compaq).*8300|hp\s*8300/i.test(s)) return "HP Compaq Elite 8300";
  const msi = /msi\s*ap\s*(\d{3})/i.exec(s);
  if (msi) return `MSI AP${msi[1]}`;
  if (/club machine/i.test(s)) return "Club machine";
  return null;
}

const OEM_NAMES: [RegExp, string][] = [
  [/^micro-?star/i, "MSI"],
  [/^dell/i, "Dell"],
  [/^hewlett|^hp\b/i, "HP"],
  [/^intel/i, "Intel"],
  [/^lenovo/i, "Lenovo"],
];

/**
 * `raw` is the register spelling before the alias table was applied; it is used when the aliased name is not a
 * known model (e.g. "Mustek6376 MST6376" + "Mecer" becomes "Mecer Mecer" after aliasing).
 */
export function registerModelFamily(
  manufacturer: string | null,
  model: string | null,
  raw?: { manufacturer: string | null; model: string | null }
): string {
  const clean = (v: string | null) => (v && !BLANK.test(v.trim()) ? v.trim() : "");
  const text = (m: string | null, n: string | null) => {
    const oem = clean(m);
    const brand = OEM_NAMES.find(([re]) => re.test(oem))?.[1] ?? oem;
    return [brand, clean(n)].filter(Boolean).join(" ");
  };
  const aliased = text(manufacturer, model);
  return knownFamily(aliased) ?? (raw ? knownFamily(text(raw.manufacturer, raw.model)) : null) ?? modelFamily(aliased);
}

/** Register spelling → export spelling (both shortened), for names that differ by more than a suffix. */
const CLUB_NAME_FIXES: Record<string, string> = {
  WESSELBRON: "WESSELSBRON",
  "GRAAF REINET": "GRAAFF REINET",
  ATHLONE: "ATHLONE GC WINDSOR PARK",
};

function clubFullKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\(PTY\)\s*LTD/g, " ")
    .replace(/\bGOLD CLUB\b/g, "GOLF CLUB")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Club name without "Golf Club", "Country Club", "CC" and similar endings. */
export function clubKey(name: string): string {
  const s = clubFullKey(name)
    .replace(/\s+(GOLF AND COUNTRY CLUB|G AND CC|GOLF CLUB|COUNTRY CLUB|GOLF COURSE|CC|GC)$/, "")
    .trim();
  return CLUB_NAME_FIXES[s] ?? s;
}

export type DeployedUnit = {
  assetName: string;
  serialNumber: string | null;
  /** After the alias table. */
  manufacturer: string | null;
  model: string | null;
  raw?: { manufacturer: string | null; model: string | null };
  club: string | null;
};

const unitFamily = (u: DeployedUnit) => registerModelFamily(u.manufacturer, u.model, u.raw);

export type FieldCaptureBreakdown = {
  byModel: { model: string; inExport: number; captured: number; notYetCaptured: number; beyondExport: number }[];
  byClub: {
    clubId: string;
    club: string;
    inExport: number;
    captured: number;
    notYetCaptured: number;
    /** e.g. "2 × Posiflex PS-3316" for the HNA-owned terminals in the export. */
    exportModels: string;
  }[];
  /** HNA-owned export rows with no register unit at that club, for technicians to capture. */
  notCaptured: { terminalId: string; clubId: string; club: string; model: string }[];
  /** Deployed register units whose club is not in the export (new sites since, or no club set). */
  outsideExport: { assetName: string; serialNumber: string | null; model: string; club: string | null }[];
  clubOwnedByModel: { model: string; count: number }[];
  blankOwnership: { terminalId: string; clubId: string; club: string; model: string }[];
};

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) out.set(key(item), (out.get(key(item)) ?? 0) + 1);
  return out;
}

function describeModels(terminals: FieldTerminal[]): string {
  return [...countBy(terminals, (t) => modelFamily(t.type))]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([model, n]) => `${n} × ${model}`)
    .join(", ");
}

/**
 * Compares HNA-owned export terminals with Deployed register hardware. There is no terminal ID in the register,
 * so units are matched by club, same model first, then any remaining unit at that club.
 */
export function buildFieldCaptureBreakdown(terminals: FieldTerminal[], deployed: DeployedUnit[]): FieldCaptureBreakdown {
  const hna = terminals.filter((t) => t.ownership === "HNA");

  const exportByModel = countBy(hna, (t) => modelFamily(t.type));
  const registerByModel = countBy(deployed, unitFamily);
  const byModel = [...new Set([...exportByModel.keys(), ...registerByModel.keys()])]
    .map((model) => {
      const inExport = exportByModel.get(model) ?? 0;
      const captured = registerByModel.get(model) ?? 0;
      return {
        model,
        inExport,
        captured,
        notYetCaptured: Math.max(inExport - captured, 0),
        beyondExport: Math.max(captured - inExport, 0),
      };
    })
    .sort((a, b) => b.inExport - a.inExport || b.captured - a.captured || a.model.localeCompare(b.model));

  type ClubGroup = { clubId: string; club: string; hna: FieldTerminal[]; all: number; units: DeployedUnit[] };
  const clubs = new Map<string, ClubGroup>();
  const byFullName = new Map<string, ClubGroup>();
  const byShortName = new Map<string, ClubGroup[]>();
  for (const t of terminals) {
    const key = t.clubId || clubFullKey(t.club);
    let group = clubs.get(key);
    if (!group) {
      group = { clubId: t.clubId, club: t.club, hna: [], all: 0, units: [] };
      clubs.set(key, group);
      byFullName.set(clubFullKey(t.club), group);
      byShortName.set(clubKey(t.club), [...(byShortName.get(clubKey(t.club)) ?? []), group]);
    }
    group.all += 1;
    if (t.ownership === "HNA") group.hna.push(t);
  }
  const findClub = (name: string): ClubGroup | undefined => {
    const exact = byFullName.get(clubFullKey(name));
    if (exact) return exact;
    const short = byShortName.get(clubKey(name));
    return short?.length === 1 ? short[0] : undefined;
  };

  const outsideExport: FieldCaptureBreakdown["outsideExport"] = [];
  for (const unit of deployed) {
    const group = unit.club ? findClub(unit.club) : undefined;
    if (group) group.units.push(unit);
    else
      outsideExport.push({
        assetName: unit.assetName,
        serialNumber: unit.serialNumber,
        model: unitFamily(unit),
        club: unit.club,
      });
  }

  const notCaptured: FieldCaptureBreakdown["notCaptured"] = [];
  const byClub: FieldCaptureBreakdown["byClub"] = [];
  for (const group of clubs.values()) {
    if (group.hna.length === 0 && group.units.length === 0) continue;
    const open = group.hna.map((t) => ({ t, model: modelFamily(t.type), taken: false }));
    let spare = 0;
    for (const unit of group.units) {
      const family = unitFamily(unit);
      const hit = open.find((o) => !o.taken && o.model === family);
      if (hit) hit.taken = true;
      else spare += 1;
    }
    for (const o of open) {
      if (spare === 0) break;
      if (o.taken) continue;
      o.taken = true;
      spare -= 1;
    }
    const left = open.filter((o) => !o.taken);
    for (const o of left) notCaptured.push({ terminalId: o.t.terminalId, clubId: o.t.clubId, club: o.t.club, model: o.model });
    byClub.push({
      clubId: group.clubId,
      club: group.club,
      inExport: group.hna.length,
      captured: group.units.length,
      notYetCaptured: left.length,
      exportModels: describeModels(group.hna),
    });
  }
  byClub.sort((a, b) => a.club.localeCompare(b.club));
  notCaptured.sort((a, b) => a.club.localeCompare(b.club) || a.terminalId.localeCompare(b.terminalId));

  return {
    byModel,
    byClub,
    notCaptured,
    outsideExport,
    clubOwnedByModel: [...countBy(terminals.filter((t) => t.ownership === "Club"), (t) => modelFamily(t.type))]
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count),
    blankOwnership: terminals
      .filter((t) => t.ownership === "")
      .map((t) => ({ terminalId: t.terminalId, clubId: t.clubId, club: t.club, model: modelFamily(t.type) })),
  };
}
