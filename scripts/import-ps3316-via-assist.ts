/**
 * Import the PS-3316 terminals marked NEW in the 2026 reconciliation through the
 * same Zoho Assist lookup, mapping and template matching as Import from Zoho Assist.
 *
 *   npx tsx scripts/import-ps3316-via-assist.ts            # dry run, no writes
 *   npx tsx scripts/import-ps3316-via-assist.ts --apply    # create the assets
 *
 * A unit is skipped (never created) when any existing asset already has its Assist
 * device id, serial number or name, when Assist has no exact name match, when no
 * device template matches, or when the serial belongs to depot stock.
 */
import { createAuditLog } from "@/lib/audit/audit-log";
import { prismaGeoFieldsFromPublicIp } from "@/lib/geo/lookup-ip";
import {
  mapAssistDeviceJsonToHardwareFields,
  mergeAssistListComputerIntoMapped,
} from "@/lib/zoho/assist-device-map";
import {
  fetchAssistDeviceDetails,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
} from "@/lib/zoho/client";
import { resolveAssistResourceId } from "@/lib/zoho/resolve-assist-resource";
import { findDeviceTemplateWithAliases } from "@/lib/inventory/find-device-template";
import { buildAliasMap } from "@/lib/inventory/model-aliases";
import { resolveHardwareFieldFromAssistAndTemplate } from "@/lib/inventory/assist-hardware-values";
import { assetTagsForDisplay, resolveTagsForSave } from "@/lib/inventory/asset-tags";
import { prisma } from "@/lib/prisma";

const UNITS: { name: string; club: string }[] = [
  { name: "HNA-DARLING-01", club: "DARLING GOLF CLUB" },
  { name: "HNA-KRONSTD-01", club: "KROONSTAD COUNTRY CLUB" },
  { name: "HNA-KYALAMI-01", club: "KYALAMI COUNTRY CLUB" },
  { name: "HNA-MIDDLBRG-01", club: "MIDDELBURG COUNTRY CLUB" },
  { name: "HNA-MOREESBURG-01", club: "MOORREESBURG GOLF CLUB" },
  { name: "HNA-MBOMBELA-01", club: "MBOMBELA GOLF CLUB" },
  { name: "HNA-PAROW-01", club: "PAROW GOLF CLUB" },
  { name: "HNA-PRTEDWARD-01", club: "PORT EDWARD COUNTRY CLUB" },
  { name: "HNA-PRINCESG-01", club: "PRINCE'S GRANT GOLF CLUB" },
  { name: "HNA-RIVERSDALE-01", club: "RIVERSDALE GOLF CLUB" },
  { name: "HNA-RONDBOSCH-01", club: "RONDEBOSCH GOLF CLUB" },
  { name: "HNA-SABIRVER-01", club: "SABI RIVER SUN GOLF CLUB" },
  { name: "HNA-STATEMINES-01", club: "STATE MINES COUNTRY CLUB" },
  { name: "HNA-TEMPE-01", club: "TEMPE GOLF CLUB" },
  { name: "HNA-WITBANK-01", club: "WITBANK GOLF CLUB" },
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

function listName(raw: unknown, key: string): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const c = await loadZohoAssistSettings();
  const departmentId = c.defaultDepartmentId?.trim() || "";
  if (!c.clientId || !c.clientSecret || !c.refreshToken || !departmentId) {
    throw new Error("Zoho Assist settings incomplete in this database.");
  }
  const { access_token } = await refreshZohoAccessToken(c);
  const orgId = c.defaultOrgId;
  const aliasMap = buildAliasMap(
    await prisma.modelAlias.findMany({ select: { kind: true, alias: true, canonical: true } })
  );
  const deployed = await prisma.assetStatus.findFirst({ where: { code: "deployed" } });
  if (!deployed) throw new Error("No deployed status.");

  const before = await prisma.asset.count();
  const seenAssist = new Set<string>();
  const seenSerial = new Set<string>();
  const rows: string[][] = [];
  let created = 0;

  for (const unit of UNITS) {
    const skip = (reason: string, extra: string[] = []) => {
      rows.push([unit.name, "SKIPPED", reason, ...extra]);
    };
    try {
      const club = await prisma.club.findFirst({
        where: { name: { equals: unit.club, mode: "insensitive" } },
        select: { id: true, name: true },
      });
      if (!club) { skip(`club not found: ${unit.club}`); continue; }

      const resolved = await resolveAssistResourceId(access_token, departmentId, orgId, {
        displayName: unit.name,
      });
      const dn = listName(resolved.listComputer, "displayName") ?? listName(resolved.listComputer, "display_name");
      const raw = await fetchAssistDeviceDetails(access_token, resolved.resourceId, { departmentId, orgId });
      let mapped = mapAssistDeviceJsonToHardwareFields(raw);
      mapped = mergeAssistListComputerIntoMapped(resolved.listComputer, mapped);
      const assistName = mapped.assetName?.trim() || dn || "";
      if (norm(assistName) !== norm(unit.name)) {
        skip(`Assist match not exact (found "${assistName}")`);
        continue;
      }

      const assistId = mapped.zohoAssistDeviceId ?? resolved.resourceId;
      const serial = mapped.serialNumber?.trim() || null;

      const byAssist = await prisma.asset.findFirst({ where: { zohoAssistDeviceId: assistId }, select: { assetName: true } });
      if (byAssist) { skip(`Assist device already on board as ${byAssist.assetName}`); continue; }
      const byName = await prisma.asset.findFirst({
        where: { assetName: { equals: unit.name, mode: "insensitive" } },
        select: { assetName: true },
      });
      if (byName) { skip(`name already on board (${byName.assetName})`); continue; }
      if (serial) {
        const bySerial = await prisma.asset.findFirst({
          where: { serialNumber: serial },
          select: { assetName: true, status: { select: { code: true } } },
        });
        if (bySerial) { skip(`serial ${serial} already on ${bySerial.assetName} (${bySerial.status.code})`); continue; }
      }
      if (seenAssist.has(assistId) || (serial && seenSerial.has(serial))) { skip("duplicate within this batch"); continue; }

      const match = await findDeviceTemplateWithAliases(mapped.manufacturer, mapped.model, aliasMap);
      const template = match.template;
      if (!template) { skip(`no device template for ${mapped.manufacturer ?? "?"} ${mapped.model ?? "?"}`); continue; }
      if (match.viaAlias) {
        mapped = { ...mapped, manufacturer: template.manufacturer, model: template.model };
      }

      seenAssist.add(assistId);
      if (serial) seenSerial.add(serial);
      const summary = [
        club.name,
        template.label,
        `${mapped.manufacturer ?? "?"} ${mapped.model ?? "?"}${match.viaAlias ? " (via alias)" : ""}`,
        serial ?? "(no serial)",
        assistId,
      ];

      if (!apply) { rows.push([unit.name, "WOULD CREATE", "", ...summary]); continue; }

      const tags = resolveTagsForSave({
        tags: assetTagsForDisplay(template.tags, template.category),
        category: template.category,
      });
      const ip = mapped.publicIp?.trim() || null;
      const geo = await prismaGeoFieldsFromPublicIp(ip);
      const asset = await prisma.asset.create({
        data: {
          assetName: unit.name,
          category: tags.category,
          tags: tags.tags,
          statusId: deployed.id,
          dataSource: "zoho_assist",
          zohoAssistDeviceId: assistId,
          zohoAssistOrgId: orgId ?? undefined,
          zohoAssistDepartmentId: departmentId,
          deviceTemplateId: template.id,
          clubId: club.id,
          deviceLocation: mapped.deviceLocation ?? undefined,
          serialNumber: serial ?? undefined,
          manufacturer: resolveHardwareFieldFromAssistAndTemplate(mapped.manufacturer, template.manufacturer),
          model: resolveHardwareFieldFromAssistAndTemplate(mapped.model, template.model),
          processorName: resolveHardwareFieldFromAssistAndTemplate(mapped.processorName, template.processorName),
          systemRam: resolveHardwareFieldFromAssistAndTemplate(mapped.systemRam, template.systemRam),
          systemGpu: resolveHardwareFieldFromAssistAndTemplate(mapped.systemGpu, template.systemGpu),
          lastSyncedFromAssistAt: new Date(),
          publicIp: ip ?? undefined,
          publicIpAssistSyncedAt: ip ? new Date() : undefined,
          ...geo,
        },
      });
      await createAuditLog({
        actionType: "asset.imported_from_zoho_assist",
        notes: `${asset.assetName} (PS-3316 reconciliation 2026, approved by Shafiek)`,
        metadata: { assetId: asset.id, zohoAssistDeviceId: assistId, deviceTemplateId: template.id, source: "PS-3316 sheet 2026" },
      });
      created++;
      rows.push([unit.name, "CREATED", "", ...summary]);
    } catch (e) {
      skip(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const r of rows) console.log(r.join(" | "));
  const after = await prisma.asset.count();
  console.log(`\n${apply ? "APPLIED" : "DRY RUN"}: assets before ${before}, after ${after}, created ${created}, skipped ${rows.filter((r) => r[1] === "SKIPPED").length}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
