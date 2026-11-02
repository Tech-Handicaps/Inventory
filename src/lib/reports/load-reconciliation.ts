import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { INVENTORY_STATS_TAG } from "@/lib/cache/inventory-stats";
import { applyAlias, loadAliasMap } from "@/lib/inventory/model-aliases";
import { classifyReportAssetType } from "@/lib/reports/asset-types";
import { buildCaptureTrend, statusEventsFromAudit, type CaptureTrend } from "@/lib/reports/capture-trend";
import { buildDifferenceBreakdown, type DifferenceBreakdown } from "@/lib/reports/difference-breakdown";
import { buildFieldCaptureBreakdown, registerModelFamily } from "@/lib/reports/field-export";
import { loadLatestFieldExport } from "@/lib/reports/load-field-export";
import {
  baselineFromTerminals,
  buildReconciliation,
  fieldCapture,
  registerComposition,
  type FieldCapture,
  type ReconciliationReport,
} from "@/lib/reports/reconciliation";

export const RECONCILIATION_TAG = "report-reconciliation";

export type ReconciliationView = ReconciliationReport & {
  fieldCapture: FieldCapture;
  captureTrend: CaptureTrend;
  differenceBreakdown: DifferenceBreakdown;
  generatedAt: string;
};

async function compute(): Promise<ReconciliationView> {
  const [lines, assets, fieldExport, aliases, auditRows] = await Promise.all([
    prisma.reconciliationLine.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.asset.findMany({
      select: {
        id: true,
        dateAdded: true,
        assetName: true,
        serialNumber: true,
        manufacturer: true,
        model: true,
        category: true,
        tags: true,
        club: { select: { name: true } },
        status: { select: { code: true } },
        _count: { select: { writeOffCertificates: true } },
      },
    }),
    loadLatestFieldExport(),
    loadAliasMap(),
    prisma.auditLog.findMany({
      where: { actionType: { in: [...STATUS_ACTIONS] } },
      select: { actionType: true, timestamp: true, metadata: true },
    }),
  ]);
  const register = registerComposition(
    assets.map((asset) => ({
      category: asset.category,
      tags: asset.tags,
      statusCode: asset.status.code,
      hasCertificate: asset._count.writeOffCertificates > 0,
    }))
  );
  const report = buildReconciliation(
    lines.map((line) => ({
      id: line.id,
      sortOrder: line.sortOrder,
      section: line.section,
      label: line.label,
      quantity: line.quantity,
      status: line.status,
      notes: line.notes,
      evidenceDocumentId: line.evidenceDocumentId,
      updatedAt: line.updatedAt.toISOString(),
    })),
    register
  );

  const isHardware = (a: (typeof assets)[number]) =>
    !["usb_hid_msr", "other"].includes(classifyReportAssetType(a.category, a.tags));
  const units = assets.filter(isHardware).map((a) => ({
    id: a.id,
    statusCode: a.status.code,
    unit: {
      assetName: a.assetName,
      serialNumber: a.serialNumber,
      manufacturer: applyAlias(aliases, "manufacturer", a.manufacturer),
      model: applyAlias(aliases, "model", a.model),
      raw: { manufacturer: a.manufacturer, model: a.model },
      club: a.club?.name ?? null,
    },
  }));

  let capture = fieldCapture(register.hardware.deployed);
  let capturedOf: ((ids: Set<string>) => number) | undefined;
  if (fieldExport) {
    const terminals = fieldExport.terminals;
    capture = fieldCapture(
      register.hardware.deployed,
      baselineFromTerminals(terminals, { fileName: fieldExport.fileName, exportDate: fieldExport.exportDate }),
      buildFieldCaptureBreakdown(
        terminals,
        units.filter((u) => u.statusCode === "deployed").map((u) => u.unit)
      ),
      fieldExport.documentId
    );
    capturedOf = (ids) =>
      buildFieldCaptureBreakdown(
        terminals,
        units.filter((u) => ids.has(u.id)).map((u) => u.unit)
      ).matched;
  }
  const captureTrend = buildCaptureTrend(
    assets.map((a) => ({ id: a.id, statusCode: a.status.code, dateAdded: a.dateAdded, hardware: isHardware(a) })),
    statusEventsFromAudit(auditRows),
    { fromMonthKey: TREND_FROM_MONTH, now: new Date(), hnaOwned: capture.baseline.hnaOwned, capturedOf }
  );
  const sumOf = (...sections: string[]) =>
    report.lines.filter((l) => sections.includes(l.section)).reduce((s, l) => s + l.quantity, 0);
  const differenceBreakdown = buildDifferenceBreakdown({
    difference: report.unexplained,
    priorLeft: sumOf("opening", "excluded"),
    addedLines: sumOf("added"),
    writtenOffLines: sumOf("written_off"),
    deployed: assets.filter((a) => a.status.code === "deployed").length,
    notDeployed: assets
      .filter((a) => a.status.code !== "deployed")
      .map((a) => {
        const manufacturer = applyAlias(aliases, "manufacturer", a.manufacturer);
        const model = applyAlias(aliases, "model", a.model);
        return {
          statusCode: a.status.code,
          family: registerModelFamily(manufacturer, model, { manufacturer: a.manufacturer, model: a.model }),
          text: [a.manufacturer, a.model, manufacturer, model].filter(Boolean).join(" "),
          label: a.assetName.startsWith("HNA-") ? a.assetName : (a.serialNumber ?? a.assetName),
        };
      }),
  });
  return {
    ...report,
    fieldCapture: capture,
    captureTrend,
    differenceBreakdown,
    generatedAt: new Date().toISOString(),
  };
}

/** The register's first asset was recorded on 18 April 2026. */
const TREND_FROM_MONTH = "2026-04";

/** Audit actions that create an asset or record a status change. */
const STATUS_ACTIONS = [
  "asset.created",
  "asset.imported_from_zoho_assist",
  "asset.updated",
  "asset.write_off",
  "asset.refurbished",
  "asset.redeployed_from_zoho_assist",
  "assessment.created",
  "assessment.completed",
  "assessment.cancelled",
  "dispatch.created",
] as const;

const cached = unstable_cache(compute, ["report-reconciliation-v6"], {
  tags: [RECONCILIATION_TAG, INVENTORY_STATS_TAG],
  revalidate: 300,
});

export function loadReconciliation(): Promise<ReconciliationView> {
  return cached();
}

export function invalidateReconciliation() {
  try {
    revalidateTag(RECONCILIATION_TAG, { expire: 0 });
  } catch {
    /* outside a request */
  }
}
