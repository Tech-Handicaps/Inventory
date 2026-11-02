import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { INVENTORY_STATS_TAG } from "@/lib/cache/inventory-stats";
import { applyAlias, loadAliasMap } from "@/lib/inventory/model-aliases";
import { classifyReportAssetType } from "@/lib/reports/asset-types";
import { buildFieldCaptureBreakdown } from "@/lib/reports/field-export";
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
  generatedAt: string;
};

async function compute(): Promise<ReconciliationView> {
  const [lines, assets, fieldExport, aliases] = await Promise.all([
    prisma.reconciliationLine.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.asset.findMany({
      select: {
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

  let capture = fieldCapture(register.hardware.deployed);
  if (fieldExport) {
    const deployed = assets
      .filter((a) => a.status.code === "deployed")
      .filter((a) => !["usb_hid_msr", "other"].includes(classifyReportAssetType(a.category, a.tags)))
      .map((a) => ({
        assetName: a.assetName,
        serialNumber: a.serialNumber,
        manufacturer: applyAlias(aliases, "manufacturer", a.manufacturer),
        model: applyAlias(aliases, "model", a.model),
        raw: { manufacturer: a.manufacturer, model: a.model },
        club: a.club?.name ?? null,
      }));
    capture = fieldCapture(
      register.hardware.deployed,
      baselineFromTerminals(fieldExport.terminals, { fileName: fieldExport.fileName, exportDate: fieldExport.exportDate }),
      buildFieldCaptureBreakdown(fieldExport.terminals, deployed),
      fieldExport.documentId
    );
  }
  return { ...report, fieldCapture: capture, generatedAt: new Date().toISOString() };
}

const cached = unstable_cache(compute, ["report-reconciliation-v3"], {
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
