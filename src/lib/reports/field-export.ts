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

/**
 * The one definition used everywhere: an HNA-owned export terminal is captured when it is matched to a Deployed
 * register unit at the same club; otherwise it is not yet captured. So captured + not yet captured = HNA-owned.
 */
export type FieldCaptureBreakdown = {
  /** By the model named in the export. `captured` = `sameModel` + `otherModel`. */
  byModel: { model: string; inExport: number; captured: number; sameModel: number; otherModel: number; notYetCaptured: number }[];
  /** Export terminals matched by a Deployed unit of a different model at that club (never an alias). */
  crossModel: { exportModel: string; registerModel: string; count: number }[];
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
  /** HNA-owned export rows matched to a Deployed unit at the same club. */
  matched: number;
  /** Deployed register units whose club is not in the export (new sites since, or no club set). */
  outsideExport: { assetName: string; serialNumber: string | null; model: string; club: string | null }[];
  /**
   * Deployed units at an export club with no HNA-owned row left to match: the club's export rows are all
   * club-owned or unowned, or the club has more units than HNA-owned rows.
   */
  unmatchedAtClubs: {
    assetName: string;
    model: string;
    club: string;
    reason: "no_hna_rows" | "beyond_export_count";
  }[];
  clubOwnedByModel: { model: string; count: number }[];
  blankOwnership: { terminalId: string; clubId: string; club: string; model: string }[];
};

/** Shown on the model rows themselves (spec 5.5). */
export const MODEL_ROW_NOTES: Record<string, string> = {
  "Lenovo M810z": "Different model from Lenovo 10Q0 – never merged or aliased.",
  "Lenovo 10Q0": "Different model from Lenovo M810z – never merged or aliased.",
};

export type CaptureArithmetic = {
  hnaOwned: number;
  matched: number;
  notCaptured: number;
  deployed: number;
  outsideExport: number;
  noHnaRows: number;
  beyondExportCount: number;
  /** Deployed units not matched to an HNA-owned export row (deployed − matched). */
  notMatched: number;
};

/**
 * 305 HNA-owned = matched + not yet captured; Deployed = matched + units that match no HNA-owned row.
 * So Deployed + not yet captured = HNA-owned + the units that match no HNA-owned row.
 */
export function captureArithmetic(deployed: number, hnaOwned: number, b: FieldCaptureBreakdown): CaptureArithmetic {
  return {
    hnaOwned,
    matched: b.matched,
    notCaptured: b.notCaptured.length,
    deployed,
    outsideExport: b.outsideExport.length,
    noHnaRows: b.unmatchedAtClubs.filter((u) => u.reason === "no_hna_rows").length,
    beyondExportCount: b.unmatchedAtClubs.filter((u) => u.reason === "beyond_export_count").length,
    notMatched: deployed - b.matched,
  };
}

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
  const unmatchedAtClubs: FieldCaptureBreakdown["unmatchedAtClubs"] = [];
  const byClub: FieldCaptureBreakdown["byClub"] = [];
  const models = new Map<string, { inExport: number; sameModel: number; otherModel: number }>();
  const cross = new Map<string, { exportModel: string; registerModel: string; count: number }>();
  for (const t of hna) {
    const m = models.get(modelFamily(t.type)) ?? { inExport: 0, sameModel: 0, otherModel: 0 };
    m.inExport += 1;
    models.set(modelFamily(t.type), m);
  }
  for (const group of clubs.values()) {
    if (group.hna.length === 0 && group.units.length === 0) continue;
    const open = group.hna.map((t) => ({ t, model: modelFamily(t.type), taken: false }));
    const spare: DeployedUnit[] = [];
    for (const unit of group.units) {
      const family = unitFamily(unit);
      const hit = open.find((o) => !o.taken && o.model === family);
      if (hit) {
        hit.taken = true;
        models.get(hit.model)!.sameModel += 1;
      } else spare.push(unit);
    }
    for (const unit of spare) {
      const any = open.find((o) => !o.taken);
      if (any) {
        any.taken = true;
        models.get(any.model)!.otherModel += 1;
        const registerModel = unitFamily(unit);
        const key = `${any.model}\u0000${registerModel}`;
        const c = cross.get(key) ?? { exportModel: any.model, registerModel, count: 0 };
        c.count += 1;
        cross.set(key, c);
      } else
        unmatchedAtClubs.push({
          assetName: unit.assetName,
          model: unitFamily(unit),
          club: group.club,
          reason: group.hna.length === 0 ? "no_hna_rows" : "beyond_export_count",
        });
    }
    const left = open.filter((o) => !o.taken);
    for (const o of left) notCaptured.push({ terminalId: o.t.terminalId, clubId: o.t.clubId, club: o.t.club, model: o.model });
    byClub.push({
      clubId: group.clubId,
      club: group.club,
      inExport: group.hna.length,
      captured: group.hna.length - left.length,
      notYetCaptured: left.length,
      exportModels: describeModels(group.hna),
    });
  }
  byClub.sort((a, b) => a.club.localeCompare(b.club));
  notCaptured.sort((a, b) => a.club.localeCompare(b.club) || a.terminalId.localeCompare(b.terminalId));

  unmatchedAtClubs.sort((a, b) => a.club.localeCompare(b.club));

  const byModel = [...models]
    .map(([model, m]) => ({
      model,
      ...m,
      captured: m.sameModel + m.otherModel,
      notYetCaptured: m.inExport - m.sameModel - m.otherModel,
    }))
    .sort((a, b) => b.inExport - a.inExport || a.model.localeCompare(b.model));

  return {
    byModel,
    crossModel: [...cross.values()].sort((a, b) => b.count - a.count || a.exportModel.localeCompare(b.exportModel)),
    byClub,
    notCaptured,
    matched: hna.length - notCaptured.length,
    outsideExport,
    unmatchedAtClubs,
    clubOwnedByModel: [...countBy(terminals.filter((t) => t.ownership === "Club"), (t) => modelFamily(t.type))]
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count),
    blankOwnership: terminals
      .filter((t) => t.ownership === "")
      .map((t) => ({ terminalId: t.terminalId, clubId: t.clubId, club: t.club, model: modelFamily(t.type) })),
  };
}
