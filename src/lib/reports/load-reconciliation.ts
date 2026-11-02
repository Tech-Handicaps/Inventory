import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { INVENTORY_STATS_TAG } from "@/lib/cache/inventory-stats";
import {
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
  const [lines, assets] = await Promise.all([
    prisma.reconciliationLine.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.asset.findMany({
      select: {
        category: true,
        tags: true,
        status: { select: { code: true } },
        _count: { select: { writeOffCertificates: true } },
      },
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
  return { ...report, fieldCapture: fieldCapture(register.hardware.deployed), generatedAt: new Date().toISOString() };
}

const cached = unstable_cache(compute, ["report-reconciliation-v1"], {
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
