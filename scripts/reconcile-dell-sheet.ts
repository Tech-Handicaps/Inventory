/**
 * Dry run: reconcile the "Dell" tab of "HNA Terminals - 2026.xlsx" against the register and Zoho Assist.
 * Reads only; nothing is written.
 *
 *   npx tsx scripts/reconcile-dell-sheet.ts <xlsx> [--out report.csv]
 *
 * Rules: Assist Terminal Name = asset name (case-insensitive). Repeated rows count once. Amanzimtoti's
 * Dell row is skipped (that site has a PS-3316). "Not found" rows need verification. A name not on the
 * register is NEW only if Assist has a device with exactly that name, no asset already has its Assist id,
 * serial or name, and a device template matches.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readXlsx } from "@/lib/xlsx/read-xlsx";
import {
  mapAssistDeviceJsonToHardwareFields,
  mergeAssistListComputerIntoMapped,
} from "@/lib/zoho/assist-device-map";
import { fetchAssistDeviceDetails, loadZohoAssistSettings, refreshZohoAccessToken } from "@/lib/zoho/client";
import { resolveAssistResourceId } from "@/lib/zoho/resolve-assist-resource";
import { findDeviceTemplateWithAliases } from "@/lib/inventory/find-device-template";
import { buildAliasMap } from "@/lib/inventory/model-aliases";
import { prisma } from "@/lib/prisma";

const SKIP_DELL_ROW = new Set(["hna-amanzimtoti-001"]);

/** Sheet club name → register club name, where the sheet uses the owning company's name. */
const CLUB_OVERRIDES: Record<string, string> = {
  "AP ARABELLA (PTY) LTD": "ARABELLA GOLF CLUB",
  "THE SAN LAMEER MASTER HOMEOWNERS ASSOCIATION NPC": "SAN LAMEER COUNTRY CLUB",
  "ATLANTIC BEACH MANAGEMENT (PTY) LTD": "ATLANTIC BEACH LINKS",
  "PEARL VALLEY INVESTMENTS (PTY) LTD": "PEARL VALLEY GOLF CLUB",
  "RIVERSIDE GOLF CLUB (KZN)": "RIVERSIDE GC KZN",
  "SILVER LAKES HOA NPC": "SILVER LAKES GOLF & WILDLIFE ESTATE",
  "STEYN CITY PROPERTIES (PTY) LTD": "THE CLUB AT STEYN CITY",
  "WOODHILL RESIDENTIAL & COUNTRY CLUB": "WOODHILL COUNTRY CLUB",
};

/** Sheet terminal name → register model. */
function normaliseModel(sheet: string): string {
  const s = sheet.toUpperCase().replace(/\s+/g, " ");
  const num = s.match(/(3050|5270|7440|7450)/)?.[1];
  if (!num) return sheet.trim();
  const aio = /AIO|ALL IN ONE/.test(s);
  return `OptiPlex ${num}${aio ? " AIO" : ""}`;
}
const family = (model: string | null | undefined) => model?.match(/(3050|5270|7440|7450)/)?.[1] ?? null;

const GENERIC = new Set(["golf", "club", "country", "estate", "and", "the", "resort", "pty", "ltd", "npc", "pbo", "gc", "cc", "kzn", "private"]);
const coreTokens = (name: string) =>
  name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/['’]/g, "")
    .replace(/[().,/-]/g, " ")
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t && !GENERIC.has(t))
    .join(" ");

type Row = { line: number; sheetModel: string; club: string; assist: string | null; live: string };
type Out = { outcome: string; line: string; asset: string; sheetClub: string; registerClub: string; sheetModel: string; registerModel: string; live: string; registerStatus: string; notes: string };

async function main() {
  const [path] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const outIdx = process.argv.indexOf("--out");
  const outPath = outIdx > 0 ? process.argv[outIdx + 1] : "/tmp/dell-reconciliation-dry-run.csv";
  const tab = readXlsx(readFileSync(path)).find((s) => s.name.trim() === "Dell");
  if (!tab) throw new Error('Tab "Dell" not found');
  const [header, ...data] = tab.rows;
  const col = (label: string) => header.findIndex((h) => String(h).trim().toLowerCase() === label.toLowerCase());
  const [cModel, cClub, cAssist, cLive] = ["Terminal Name", "Club Name", "Assist Terminal Name", "Live Status"].map(col);
  const rows: Row[] = data
    .map((r, i) => ({
      line: i + 2,
      sheetModel: String(r[cModel] ?? "").trim(),
      club: String(r[cClub] ?? "").trim(),
      assist: /^HNA-/i.test(String(r[cAssist] ?? "").trim()) ? String(r[cAssist]).trim() : null,
      live: String(r[cLive] ?? "").trim(),
    }))
    .filter((r) => r.sheetModel || r.club);

  const assets = await prisma.asset.findMany({
    select: { id: true, assetName: true, model: true, manufacturer: true, serialNumber: true, zohoAssistDeviceId: true,
      club: { select: { name: true } }, status: { select: { code: true } } },
  });
  const clubs = await prisma.club.findMany({ select: { id: true, name: true } });
  const byName = new Map(assets.map((a) => [a.assetName.trim().toLowerCase(), a]));
  const clubByCore = new Map<string, { id: string; name: string }[]>();
  for (const c of clubs) clubByCore.set(coreTokens(c.name), [...(clubByCore.get(coreTokens(c.name)) ?? []), c]);
  const findClub = (name: string) => {
    const override = CLUB_OVERRIDES[name.trim().toUpperCase()];
    if (override) return clubs.find((c) => c.name === override) ?? null;
    const hits = clubByCore.get(coreTokens(name)) ?? [];
    return hits.length === 1 ? hits[0] : null;
  };

  const zc = await loadZohoAssistSettings();
  const departmentId = zc.defaultDepartmentId?.trim() || "";
  const { access_token } = await refreshZohoAccessToken(zc);
  const aliasMap = buildAliasMap(await prisma.modelAlias.findMany({ select: { kind: true, alias: true, canonical: true } }));

  const out: Out[] = [];
  const seen = new Set<string>();
  const sheetNames = new Set<string>();
  for (const r of rows) {
    const model = normaliseModel(r.sheetModel);
    const base = { line: String(r.line), sheetClub: r.club, sheetModel: model, live: r.live };
    if (!r.assist) {
      const club = findClub(r.club);
      const atClub = club ? assets.filter((a) => a.club?.name === club.name && a.status.code === "deployed") : [];
      out.push({ ...base, outcome: "NEEDS VERIFICATION", asset: "", registerClub: club?.name ?? "",
        registerModel: atClub.map((a) => a.model).join("; "), registerStatus: "",
        notes: `No Assist ID in sheet${!club ? "; club not found on register" : ""}${atClub.length ? `; register has ${atClub.map((a) => a.assetName).join(", ")} at this club` : ""}` });
      continue;
    }
    const key = r.assist.toLowerCase();
    sheetNames.add(key);
    if (seen.has(key)) {
      out.push({ ...base, outcome: "DUPLICATE ROW", asset: r.assist, registerClub: "", registerModel: "", registerStatus: "", notes: "Same terminal listed again in the sheet; counted once" });
      continue;
    }
    seen.add(key);
    if (SKIP_DELL_ROW.has(key)) {
      const a = byName.get(key);
      out.push({ ...base, outcome: "SKIPPED", asset: r.assist, registerClub: a?.club?.name ?? "", registerModel: a ? `${a.manufacturer ?? ""} ${a.model ?? ""}`.trim() : "",
        registerStatus: a?.status.code ?? "", notes: "Site has a PS-3316, not a Dell; Dell row not imported" });
      continue;
    }
    const existing = byName.get(key);
    if (existing) {
      const notes: string[] = [];
      if (family(existing.model) !== family(model)) notes.push(`model differs: register ${existing.model ?? "none"}`);
      else if (existing.model !== model) notes.push(`same model family (register ${existing.model})`);
      const club = findClub(r.club);
      if (existing.club?.name && club && club.name !== existing.club.name) notes.push(`club differs: register ${existing.club.name}`);
      if (existing.status.code !== "deployed") notes.push(`register status is ${existing.status.code} but sheet lists it at the club`);
      out.push({ ...base, outcome: notes.some((n) => /differs|status/.test(n)) ? "MATCHED, CHECK" : "MATCHED", asset: existing.assetName,
        registerClub: existing.club?.name ?? "", registerModel: existing.model ?? "", registerStatus: existing.status.code, notes: notes.join("; ") });
      continue;
    }
    // Not on the register: check Assist and every duplicate route.
    const club = findClub(r.club);
    const row: Out = { ...base, outcome: "NEW", asset: r.assist, registerClub: club?.name ?? "", registerModel: "", registerStatus: "deployed (on import)", notes: "" };
    try {
      const resolved = await resolveAssistResourceId(access_token, departmentId, zc.defaultOrgId, { displayName: r.assist });
      const raw = await fetchAssistDeviceDetails(access_token, resolved.resourceId, { departmentId, orgId: zc.defaultOrgId });
      const mapped = mergeAssistListComputerIntoMapped(resolved.listComputer, mapAssistDeviceJsonToHardwareFields(raw));
      const assistId = mapped.zohoAssistDeviceId ?? resolved.resourceId;
      const serial = mapped.serialNumber?.trim() || null;
      const problems: string[] = [];
      if ((mapped.assetName ?? "").trim().toLowerCase() !== key) problems.push(`Assist match not exact ("${mapped.assetName}")`);
      const byAssist = assets.find((a) => a.zohoAssistDeviceId === assistId);
      if (byAssist) problems.push(`Assist device already on register as ${byAssist.assetName}`);
      const bySerial = serial ? assets.find((a) => a.serialNumber === serial) : undefined;
      if (bySerial) problems.push(`serial ${serial} already on ${bySerial.assetName} (${bySerial.status.code})`);
      const match = await findDeviceTemplateWithAliases(mapped.manufacturer, mapped.model, aliasMap);
      if (!match.template) problems.push(`no device template for Assist ${mapped.manufacturer ?? "?"} ${mapped.model ?? "?"}`);
      if (!club) problems.push("club not found on register");
      const assistModel = match.template?.model ?? mapped.model ?? "";
      if (family(assistModel) !== family(model)) problems.push(`Assist reports ${assistModel || "no model"}, sheet says ${model}`);
      row.registerModel = assistModel;
      row.notes = [`serial ${serial ?? "none"}`, `template ${match.template?.label ?? "none"}`, ...problems].join("; ");
      if (problems.length) row.outcome = "NEEDS VERIFICATION";
    } catch (e) {
      row.outcome = "NEEDS VERIFICATION";
      row.notes = `Not found in Zoho Assist: ${e instanceof Error ? e.message : String(e)}`;
    }
    out.push(row);
  }

  for (const a of assets) {
    if (!/optiplex/i.test(a.model ?? "") || sheetNames.has(a.assetName.toLowerCase())) continue;
    out.push({ outcome: "IN INVENTORY, NOT IN SHEET", line: "", asset: a.assetName, sheetClub: "", registerClub: a.club?.name ?? "",
      sheetModel: "", registerModel: a.model ?? "", live: "", registerStatus: a.status.code, notes: "Dell on the register with no row in the Dell tab" });
  }

  const order = ["NEW", "MATCHED", "MATCHED, CHECK", "NEEDS VERIFICATION", "SKIPPED", "DUPLICATE ROW", "IN INVENTORY, NOT IN SHEET"];
  out.sort((a, b) => order.indexOf(a.outcome) - order.indexOf(b.outcome) || Number(a.line || 999) - Number(b.line || 999));
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cols: (keyof Out)[] = ["outcome", "line", "asset", "sheetClub", "registerClub", "sheetModel", "registerModel", "live", "registerStatus", "notes"];
  writeFileSync(outPath, [["Outcome", "Sheet line", "Asset name", "Sheet club", "Register club", "Sheet model (normalised)", "Register / Assist model", "Sheet live status", "Register status", "Notes"].join(","),
    ...out.map((o) => cols.map((c) => esc(o[c])).join(","))].join("\n") + "\n");
  const counts = order.map((o) => `${o} ${out.filter((x) => x.outcome === o).length}`).join(" · ");
  console.log(`Sheet rows: ${rows.length}\n${counts}\nReport: ${outPath}\nDry run: nothing written.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
