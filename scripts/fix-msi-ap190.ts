/**
 * MS-A95311 is the MSI motherboard name, captured in error by finance; the machine is the MSI AP190
 * (confirmed by Mogamat, 2 Nov 2026).
 *
 * - Corrects manufacturer/model on the affected asset(s) to MSI / AP190, audit-logged on each asset with the
 *   original values, so the change and the old value show in the asset's history.
 * - Renames the device template that was created from that device to "MSI AP190" (MSI / AP190).
 * - Adds the aliases MS-A95311 → AP190 (model) and MICRO-STAR INTERNATIONAL CO., LTD → MSI (brand), so Assist
 *   imports that report the motherboard name match the MSI AP190 template and are stored as MSI AP190.
 *
 * Idempotent: rows already corrected are left alone. Dry run unless --apply.
 * Run with: npx tsx scripts/fix-msi-ap190.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const REASON = "model captured as motherboard name";
const WRONG_MODEL = "MS-A95311";
const WRONG_MANUFACTURER = "MICRO-STAR INTERNATIONAL CO., LTD";
const MANUFACTURER = "MSI";
const MODEL = "AP190";
const CONFIRMED = "Confirmed by Mogamat: MS-A95311 is the motherboard name, captured in error by finance; the machine is the MSI AP190.";

function loadEnv() {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  let raw = process.env.DATABASE_URL ?? "";
  if (raw.startsWith("postgres://")) raw = `postgresql://${raw.slice("postgres://".length)}`;
  const url = new URL(raw);
  if (url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: loadEnv() } } });
  const log = (msg: string) => console.log(`${APPLY ? "" : "[dry run] "}${msg}`);
  try {
    const assets = await prisma.asset.findMany({
      where: { model: { equals: WRONG_MODEL, mode: "insensitive" } },
      select: { id: true, assetName: true, manufacturer: true, model: true },
    });
    for (const asset of assets) {
      const changes = {
        manufacturer: { from: asset.manufacturer, to: MANUFACTURER },
        model: { from: asset.model, to: MODEL },
      };
      log(`asset ${asset.assetName}: ${asset.manufacturer} ${asset.model} → ${MANUFACTURER} ${MODEL}`);
      if (!APPLY) continue;
      await prisma.$transaction([
        prisma.asset.update({ where: { id: asset.id }, data: { manufacturer: MANUFACTURER, model: MODEL } }),
        prisma.auditLog.create({
          data: {
            actionType: "asset.updated",
            notes: `Model corrected from ${asset.manufacturer ?? ""} ${asset.model} to ${MANUFACTURER} ${MODEL} – ${REASON}.`.replace(/\s+/g, " "),
            metadata: { assetId: asset.id, changes, reason: REASON, confirmedBy: "Mogamat", note: CONFIRMED },
          },
        }),
      ]);
    }
    if (assets.length === 0) log("no assets with the motherboard name as model");

    const template = await prisma.deviceTemplate.findFirst({
      where: { model: { equals: WRONG_MODEL, mode: "insensitive" } },
    });
    const target = await prisma.deviceTemplate.findFirst({
      where: { manufacturer: { equals: MANUFACTURER, mode: "insensitive" }, model: { equals: MODEL, mode: "insensitive" } },
    });
    if (template && target) {
      log(`template "${template.label}" left as is: an ${MANUFACTURER} ${MODEL} template already exists ("${target.label}")`);
    } else if (template) {
      const notes = `Zoho Assist reports the motherboard name ${WRONG_MANUFACTURER} ${WRONG_MODEL} for this machine; imports with that name match here through the model alias table.`;
      log(`template "${template.label}" (${template.manufacturer} ${template.model}) → "MSI AP190" (${MANUFACTURER} ${MODEL})`);
      if (APPLY) {
        await prisma.$transaction([
          prisma.deviceTemplate.update({
            where: { id: template.id },
            data: { label: "MSI AP190", manufacturer: MANUFACTURER, model: MODEL, notes: template.notes ? `${template.notes}\n${notes}` : notes },
          }),
          prisma.auditLog.create({
            data: {
              actionType: "device_template.updated",
              notes: `Template "${template.label}" corrected to MSI AP190 – ${REASON}.`,
              metadata: {
                deviceTemplateId: template.id,
                changes: {
                  label: { from: template.label, to: "MSI AP190" },
                  manufacturer: { from: template.manufacturer, to: MANUFACTURER },
                  model: { from: template.model, to: MODEL },
                },
                reason: REASON,
                confirmedBy: "Mogamat",
              },
            },
          }),
        ]);
      }
    } else {
      log(`no template with model ${WRONG_MODEL}`);
    }

    const aliases = [
      { kind: "model", alias: WRONG_MODEL, canonical: MODEL, notes: `Motherboard name of the MSI AP190, captured in error by finance (confirmed by Mogamat).` },
      { kind: "manufacturer", alias: WRONG_MANUFACTURER, canonical: MANUFACTURER, notes: "Company name reported by Zoho Assist; the brand is MSI." },
    ];
    for (const a of aliases) {
      const existing = await prisma.modelAlias.findUnique({ where: { kind_alias: { kind: a.kind, alias: a.alias } } });
      if (existing) {
        log(`alias ${a.kind} "${a.alias}" already recorded as "${existing.canonical}"`);
        continue;
      }
      log(`alias ${a.kind} "${a.alias}" → "${a.canonical}"`);
      if (!APPLY) continue;
      const row = await prisma.modelAlias.create({ data: { ...a, createdBy: "system" } });
      await prisma.auditLog.create({
        data: {
          actionType: "report.model_alias_added",
          notes: `"${a.alias}" counted as ${a.canonical} – ${REASON}.`,
          metadata: { aliasId: row.id, kind: a.kind, alias: a.alias, canonical: a.canonical, reason: REASON, confirmedBy: "Mogamat" },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
