/**
 * Reconcile the "Posiflex PS-3316" tab of "HNA Terminals - 2026.xlsx" against the register.
 *
 *   npx tsx scripts/import-ps3316-sheet.ts <xlsx> [--out report.csv]      dry run: writes the report only
 *   npx tsx scripts/import-ps3316-sheet.ts <xlsx> --apply                 adds NEW rows in one transaction
 *
 * Matching: Assist Terminal Name = asset name (trimmed, case-insensitive); club + model is only a
 * fallback flag. Re-running never duplicates: a name already on the register is MATCHED, not added.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { readXlsx } from "../src/lib/xlsx/read-xlsx";

const prisma = new PrismaClient();
const SOURCE_NOTE = "PS-3316 sheet 2026";
const MODEL = "PS-3316";

/** Sheet club name → register club name, where the names differ (agreed mappings). */
const CLUB_OVERRIDES: Record<string, string> = {
  "JEFFREYS BAY G": "JEFFREYS BAY GOLF CLUB",
  "KWA JABU CLUB/GOWRIE FARM": "GOWRIE FARM GOLF CLUB",
  "NELSPRUIT GOLF CLUB": "MBOMBELA GOLF CLUB",
  "TURTLE CREEK GOLF ESTATE PTY (LTD)": "GOOSE VALLEY GOLF CLUB",
  "SOUTHERN SUN HOTEL INTERESTS (PTY) LTD": "SABI RIVER SUN GOLF CLUB",
  "GREENSIDE GOLF CLUB": "GREENSIDE COLLIERY GOLF CLUB",
  "HEIDELBERG GOLF CLUB (CT)": "HEIDELBERG GOLF CLUB (CAPE)",
};

type SheetRow = { line: number; clubName: string; members: string; assistName: string | null; liveStatus: string };
type Outcome = "MATCHED" | "NEW" | "NEEDS VERIFICATION" | "IN INVENTORY, NOT IN SHEET";
type ReportLine = {
  outcome: Outcome;
  sheetLine: string;
  assetName: string;
  sheetClub: string;
  registerClub: string;
  liveStatus: string;
  registerStatus: string;
  notes: string;
};

const norm = (s: string) => s.trim().toLowerCase();
const GENERIC = new Set(["golf", "club", "country", "estate", "and", "the", "resort", "pty", "ltd", "g", "gc", "cc", "ct", "cape"]);
function coreTokens(name: string): string {
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/['’]/g, "")
    .replace(/\(PTY\)|\bPTY\b|\bLTD\b|\(|\)|[.,'/-]/g, " ")
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t && !GENERIC.has(t))
    .join(" ");
}

function readSheet(path: string): SheetRow[] {
  const tab = readXlsx(readFileSync(path)).find((s) => s.name.trim() === "Posiflex PS-3316");
  if (!tab) throw new Error('Tab "Posiflex PS-3316" not found');
  const [header, ...rows] = tab.rows;
  const col = (label: string) => {
    const i = header.findIndex((h) => norm(h ?? "") === norm(label));
    if (i < 0) throw new Error(`Column "${label}" missing`);
    return i;
  };
  const [cClub, cMembers, cAssist, cLive] = ["Club Name", "Member Count", "Assist Terminal Name", "Live Status"].map(col);
  return rows
    .map((r, i) => {
      const assist = (r[cAssist] ?? "").trim();
      return {
        line: i + 2,
        clubName: (r[cClub] ?? "").trim(),
        members: (r[cMembers] ?? "").trim().replace(/\.0$/, ""),
        assistName: /^HNA-/i.test(assist) ? assist : null,
        liveStatus: (r[cLive] ?? "").trim(),
      };
    })
    .filter((r) => r.clubName);
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Usage: import-ps3316-sheet.ts <xlsx> [--apply] [--out report.csv]");
  const apply = args.includes("--apply");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : "ps3316-reconciliation.csv";

  const sheet = readSheet(file);
  const [assets, clubs, deployed, template] = await Promise.all([
    prisma.asset.findMany({
      select: {
        id: true, assetName: true, model: true, manufacturer: true,
        club: { select: { id: true, name: true } }, status: { select: { code: true } },
        deviceTemplate: { select: { model: true } },
      },
    }),
    prisma.club.findMany({ select: { id: true, name: true } }),
    prisma.assetStatus.findUnique({ where: { code: "deployed" } }),
    prisma.deviceTemplate.findFirst({ where: { model: MODEL } }),
  ]);
  if (!deployed) throw new Error('Status "deployed" missing');

  const byName = new Map<string, (typeof assets)[number][]>();
  for (const a of assets) byName.set(norm(a.assetName), [...(byName.get(norm(a.assetName)) ?? []), a]);
  const isPs3316 = (a: (typeof assets)[number]) => /3316/.test(a.model ?? a.deviceTemplate?.model ?? "");

  const clubByExact = new Map(clubs.map((c) => [c.name.toUpperCase(), c]));
  const clubsByCore = new Map<string, typeof clubs>();
  for (const c of clubs) clubsByCore.set(coreTokens(c.name), [...(clubsByCore.get(coreTokens(c.name)) ?? []), c]);
  function resolveClub(sheetName: string): { club: (typeof clubs)[number] | null; note: string } {
    const upper = sheetName.toUpperCase();
    const override = CLUB_OVERRIDES[upper];
    if (override) return { club: clubByExact.get(override) ?? null, note: `club mapped to ${override}` };
    const exact = clubByExact.get(upper);
    if (exact) return { club: exact, note: "" };
    const candidates = clubsByCore.get(coreTokens(sheetName)) ?? [];
    if (candidates.length === 1) return { club: candidates[0], note: `club matched by name to ${candidates[0].name}` };
    if (candidates.length > 1) return { club: null, note: `club ambiguous: ${candidates.map((c) => c.name).join(" / ")}` };
    return { club: null, note: "no matching club record" };
  }

  const report: ReportLine[] = [];
  const toCreate: { row: SheetRow; clubId: string; clubName: string }[] = [];
  const sheetNames = new Set<string>();

  for (const row of sheet) {
    const base = { sheetLine: String(row.line), sheetClub: row.clubName, liveStatus: row.liveStatus };
    if (!row.assistName) {
      report.push({ ...base, outcome: "NEEDS VERIFICATION", assetName: "", registerClub: "", registerStatus: "", notes: "No Assist ID in sheet; not imported" });
      continue;
    }
    sheetNames.add(norm(row.assistName));
    const { club, note: clubNote } = resolveClub(row.clubName);
    const existing = byName.get(norm(row.assistName)) ?? [];

    if (existing.length > 1) {
      report.push({ ...base, outcome: "NEEDS VERIFICATION", assetName: row.assistName, registerClub: existing.map((e) => e.club?.name ?? "-").join(" / "), registerStatus: existing.map((e) => e.status.code).join(" / "), notes: `${existing.length} assets already share this name` });
      continue;
    }
    if (existing.length === 1) {
      const a = existing[0];
      const diffs: string[] = [];
      if (a.assetName !== row.assistName) diffs.push(`register spells it ${a.assetName}`);
      if (!club) diffs.push(`sheet club not matched to a club record (${clubNote})`);
      else if (a.club?.id !== club.id) diffs.push(`club differs: register ${a.club?.name ?? "none"}, sheet ${club.name}`);
      if (!isPs3316(a)) diffs.push(`model differs: register ${a.model ?? a.deviceTemplate?.model ?? "none"}`);
      if (a.status.code !== "deployed") diffs.push(`register status ${a.status.code}`);
      if (!isPs3316(a)) {
        const samePs = club ? assets.filter((x) => x.club?.id === club.id && isPs3316(x)).map((x) => x.assetName) : [];
        if (samePs.length) diffs.push(`the PS-3316 at ${club!.name} is ${samePs.join(", ")}`);
        report.push({ ...base, outcome: "NEEDS VERIFICATION", assetName: a.assetName, registerClub: a.club?.name ?? "", registerStatus: a.status.code, notes: `Name is on the register but not as a PS-3316: ${diffs.join("; ")}` });
        continue;
      }
      report.push({ ...base, outcome: "MATCHED", assetName: a.assetName, registerClub: a.club?.name ?? "", registerStatus: a.status.code, notes: diffs.join("; ") || "no differences" });
      continue;
    }

    const sameClub = club ? assets.filter((a) => a.club?.id === club.id && isPs3316(a)) : [];
    if (sameClub.length > 0) {
      report.push({ ...base, outcome: "NEEDS VERIFICATION", assetName: row.assistName, registerClub: club!.name, registerStatus: sameClub.map((a) => a.status.code).join(" / "), notes: `Name not on register, but ${sameClub.map((a) => a.assetName).join(", ")} is a PS-3316 at this club; same unit renamed?` });
      continue;
    }
    if (!club) {
      report.push({ ...base, outcome: "NEEDS VERIFICATION", assetName: row.assistName, registerClub: "", registerStatus: "", notes: `Would be new, but ${clubNote}` });
      continue;
    }
    report.push({ ...base, outcome: "NEW", assetName: row.assistName, registerClub: club.name, registerStatus: "deployed (on import)", notes: [clubNote, `members ${row.members}`].filter(Boolean).join("; ") });
    toCreate.push({ row, clubId: club.id, clubName: club.name });
  }

  for (const a of assets) {
    if (!isPs3316(a) || sheetNames.has(norm(a.assetName))) continue;
    report.push({ outcome: "IN INVENTORY, NOT IN SHEET", sheetLine: "", assetName: a.assetName, sheetClub: "", registerClub: a.club?.name ?? "", liveStatus: "", registerStatus: a.status.code, notes: a.club ? "Deployed PS-3316 missing from the sheet" : "Not at a club (stock)" });
  }

  const header = ["Outcome", "Sheet line", "Asset name", "Sheet club", "Register club", "Sheet live status", "Register status", "Notes"];
  const lines = report.map((r) => [r.outcome, r.sheetLine, r.assetName, r.sheetClub, r.registerClub, r.liveStatus, r.registerStatus, r.notes].map(csvCell).join(","));
  writeFileSync(outPath, [header.join(","), ...lines].join("\n") + "\n");

  const count = (o: Outcome) => report.filter((r) => r.outcome === o).length;
  console.log(`Sheet rows: ${sheet.length}`);
  console.log(`MATCHED ${count("MATCHED")} · NEW ${count("NEW")} · NEEDS VERIFICATION ${count("NEEDS VERIFICATION")} · IN INVENTORY, NOT IN SHEET ${count("IN INVENTORY, NOT IN SHEET")}`);
  console.log(`Report: ${outPath}`);

  if (!apply) {
    console.log("Dry run: nothing written.");
    return;
  }

  const created = await prisma.$transaction(async (tx) => {
    const out: { id: string; assetName: string }[] = [];
    for (const { row, clubId, clubName } of toCreate) {
      const name = row.assistName!;
      const clash = await tx.asset.findFirst({ where: { assetName: { equals: name, mode: "insensitive" } }, select: { id: true } });
      if (clash) continue;
      const asset = await tx.asset.create({
        data: {
          assetName: name,
          category: template?.category ?? "Hardware",
          tags: template?.tags?.length ? template.tags : ["Hardware"],
          manufacturer: template?.manufacturer ?? "PosiFlex",
          model: MODEL,
          deviceTemplateId: template?.id ?? null,
          clubId,
          statusId: deployed.id,
          dataSource: "manual",
        },
        select: { id: true, assetName: true },
      });
      await tx.auditLog.create({
        data: {
          actionType: "asset.created",
          notes: `${asset.assetName} (${SOURCE_NOTE})`,
          metadata: {
            assetId: asset.id,
            source: SOURCE_NOTE,
            sheetLine: row.line,
            club: clubName,
            sheetLiveStatus: row.liveStatus,
            memberCount: row.members,
          },
        },
      });
      out.push(asset);
    }
    return out;
  });
  console.log(`Added ${created.length}: ${created.map((c) => c.assetName).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
