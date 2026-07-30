import type { Prisma } from "@prisma/client";
import {
  ALL_REPORT_ASSET_TYPES,
  classifyReportAssetType,
  RECONCILE_ASSET_TYPES,
  reportAssetTypeLabel,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";

export type AssetForReconcile = {
  id: string;
  category: string;
  tags?: string[] | null;
  status: { code: string; label: string };
};

export type StockReconcileRow = {
  assetTypeId: ReportAssetTypeId;
  assetTypeLabel: string;
  newStock: number;
  refurbished: number;
  totalStock: number;
};

export type FullStatusReconcileRow = {
  assetTypeId: ReportAssetTypeId;
  assetTypeLabel: string;
  newStock: number;
  refurbished: number;
  totalStock: number;
  deployed: number;
  assessment: number;
  repair: number;
  writtenOff: number;
  grandTotal: number;
};

export type StockReconcileReport = {
  generatedNote: string;
  stockRows: StockReconcileRow[];
  stockGrandTotal: Pick<StockReconcileRow, "newStock" | "refurbished" | "totalStock">;
  fullStatusRows: FullStatusReconcileRow[];
  fullStatusGrandTotal: Omit<FullStatusReconcileRow, "assetTypeId" | "assetTypeLabel">;
  uncategorizedCount: number;
};

function emptyStockRow(typeId: ReportAssetTypeId): StockReconcileRow {
  return {
    assetTypeId: typeId,
    assetTypeLabel: reportAssetTypeLabel(typeId),
    newStock: 0,
    refurbished: 0,
    totalStock: 0,
  };
}

function emptyFullRow(typeId: ReportAssetTypeId): FullStatusReconcileRow {
  return {
    assetTypeId: typeId,
    assetTypeLabel: reportAssetTypeLabel(typeId),
    newStock: 0,
    refurbished: 0,
    totalStock: 0,
    deployed: 0,
    assessment: 0,
    repair: 0,
    writtenOff: 0,
    grandTotal: 0,
  };
}

/** Build finance reconcile counts from live assets (point-in-time snapshot). */
export function buildStockReconcileReport(
  assets: AssetForReconcile[]
): StockReconcileReport {
  const stockByType = new Map<ReportAssetTypeId, StockReconcileRow>();
  const fullByType = new Map<ReportAssetTypeId, FullStatusReconcileRow>();

  for (const type of ALL_REPORT_ASSET_TYPES) {
    stockByType.set(type.id, emptyStockRow(type.id));
    fullByType.set(type.id, emptyFullRow(type.id));
  }

  for (const asset of assets) {
    const typeId = classifyReportAssetType(asset.category, asset.tags);
    const stock = stockByType.get(typeId)!;
    const full = fullByType.get(typeId)!;
    const code = asset.status.code;

    full.grandTotal += 1;

    if (code === "new_stock") {
      stock.newStock += 1;
      full.newStock += 1;
    } else if (code === "refurbished") {
      stock.refurbished += 1;
      full.refurbished += 1;
    } else if (code === "deployed") {
      full.deployed += 1;
    } else if (code === "assessment") {
      full.assessment += 1;
    } else if (code === "repair") {
      full.repair += 1;
    } else if (code === "written_off") {
      full.writtenOff += 1;
    }

    stock.totalStock = stock.newStock + stock.refurbished;
    full.totalStock = full.newStock + full.refurbished;
  }

  const stockRows = RECONCILE_ASSET_TYPES.map((t) => stockByType.get(t.id)!);
  const fullStatusRows = RECONCILE_ASSET_TYPES.map((t) => fullByType.get(t.id)!);

  const otherFull = fullByType.get("other")!;

  const stockGrandTotal = stockRows.reduce(
    (acc, row) => ({
      newStock: acc.newStock + row.newStock,
      refurbished: acc.refurbished + row.refurbished,
      totalStock: acc.totalStock + row.totalStock,
    }),
    { newStock: 0, refurbished: 0, totalStock: 0 }
  );

  const fullStatusGrandTotal = fullStatusRows.reduce(
    (acc, row) => ({
      newStock: acc.newStock + row.newStock,
      refurbished: acc.refurbished + row.refurbished,
      totalStock: acc.totalStock + row.totalStock,
      deployed: acc.deployed + row.deployed,
      assessment: acc.assessment + row.assessment,
      repair: acc.repair + row.repair,
      writtenOff: acc.writtenOff + row.writtenOff,
      grandTotal: acc.grandTotal + row.grandTotal,
    }),
    {
      newStock: 0,
      refurbished: 0,
      totalStock: 0,
      deployed: 0,
      assessment: 0,
      repair: 0,
      writtenOff: 0,
      grandTotal: 0,
    }
  );

  return {
    generatedNote:
      "Point-in-time snapshot of the live register. Total stock = New stock + Refurbished per asset type.",
    stockRows,
    stockGrandTotal,
    fullStatusRows,
    fullStatusGrandTotal,
    uncategorizedCount: otherFull.grandTotal,
  };
}

export type StockStatusFilter = "new_stock" | "refurbished";

/** Filter assets by report type + lifecycle status (in-memory after fetch). */
export function filterAssetsByReportTypeAndStatus<
  T extends AssetForReconcile & Record<string, unknown>,
>(assets: T[], typeId: ReportAssetTypeId, status: StockStatusFilter): T[] {
  return assets.filter(
    (a) =>
      classifyReportAssetType(a.category, a.tags) === typeId &&
      a.status.code === status
  );
}

export const stockStatusInclude = {
  status: true,
} as const satisfies Prisma.AssetInclude;
