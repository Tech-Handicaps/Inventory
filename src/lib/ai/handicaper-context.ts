import { prisma } from "@/lib/prisma";
import {
  classifyReportAssetType,
  reportAssetTypeLabel,
} from "@/lib/reports/asset-types";
import { resolveAssetSkuModelLabel } from "@/lib/inventory/device-template-label";

export type StockModelRow = {
  label: string;
  assetType: string;
  newStock: number;
  refurbished: number;
  total: number;
};

export type HandicaperInventoryContext = {
  generatedAt: string;
  totals: {
    registered: number;
    byStatus: { code: string; label: string; count: number }[];
  };
  available: {
    terminalsComputersAio: { newStock: number; refurbished: number; total: number };
    cardReaders: { newStock: number; refurbished: number; total: number };
  };
  /** Every make/model in new stock or refurbished — use for stock breakdown questions. */
  stockByModel: StockModelRow[];
  assetTypes: { type: string; count: number }[];
  topModels: { label: string; count: number }[];
  topCategories: { category: string; count: number }[];
  dataSources: { source: string; count: number }[];
  repairsOpen: number;
  writeOffs: number;
  recentActivity: {
    assetName: string;
    status: string;
    category: string;
    updatedAt: string;
  }[];
  clubsWithAssets: number;
};

export async function buildHandicaperInventoryContext(): Promise<HandicaperInventoryContext> {
  const [
    assets,
    repairsOpen,
    writeOffs,
    clubCount,
    byCategory,
    bySource,
  ] = await Promise.all([
    prisma.asset.findMany({
      select: {
        assetName: true,
        category: true,
        tags: true,
        manufacturer: true,
        model: true,
        dataSource: true,
        dateUpdated: true,
        status: { select: { code: true, label: true } },
      },
    }),
    prisma.repair.count({
      where: {
        repairStatus: { in: ["pending", "in_progress"] },
      },
    }),
    prisma.asset.count({
      where: { status: { code: "written_off" } },
    }),
    prisma.club.count({ where: { assets: { some: {} } } }),
    prisma.asset.groupBy({
      by: ["category"],
      _count: { id: true },
    }),
    prisma.asset.groupBy({
      by: ["dataSource"],
      _count: { id: true },
    }),
  ]);

  const byStatusMap = new Map<string, { code: string; label: string; count: number }>();
  for (const a of assets) {
    const code = a.status.code;
    const label = a.status.label;
    const prev = byStatusMap.get(code) ?? { code, label, count: 0 };
    prev.count += 1;
    byStatusMap.set(code, prev);
  }

  const available = {
    terminalsComputersAio: { newStock: 0, refurbished: 0, total: 0 },
    cardReaders: { newStock: 0, refurbished: 0, total: 0 },
  };

  const typeCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const stockByModelMap = new Map<
    string,
    StockModelRow & { key: string }
  >();

  for (const a of assets) {
    const typeId = classifyReportAssetType(a.category, a.tags);
    const typeLabel = reportAssetTypeLabel(typeId);
    typeCounts.set(typeLabel, (typeCounts.get(typeLabel) ?? 0) + 1);

    const modelLabel = resolveAssetSkuModelLabel(a);
    modelCounts.set(modelLabel, (modelCounts.get(modelLabel) ?? 0) + 1);

    const code = a.status.code;
    if (code === "new_stock" || code === "refurbished") {
      const stockKey = `${typeLabel}::${modelLabel}`;
      const row = stockByModelMap.get(stockKey) ?? {
        key: stockKey,
        label: modelLabel,
        assetType: typeLabel,
        newStock: 0,
        refurbished: 0,
        total: 0,
      };
      if (code === "new_stock") row.newStock += 1;
      if (code === "refurbished") row.refurbished += 1;
      row.total += 1;
      stockByModelMap.set(stockKey, row);

      const bucket =
        typeId === "usb_hid_msr"
          ? available.cardReaders
          : typeId === "hardware"
            ? available.terminalsComputersAio
            : null;
      if (bucket) {
        if (code === "new_stock") bucket.newStock += 1;
        if (code === "refurbished") bucket.refurbished += 1;
        bucket.total += 1;
      }
    }
  }

  const stockByModel = [...stockByModelMap.values()]
    .map(({ key: _key, ...row }) => row)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const recentActivity = [...assets]
    .sort(
      (a, b) =>
        new Date(b.dateUpdated).getTime() - new Date(a.dateUpdated).getTime()
    )
    .slice(0, 8)
    .map((a) => ({
      assetName: a.assetName,
      status: a.status.label,
      category: a.category,
      updatedAt: a.dateUpdated.toISOString(),
    }));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      registered: assets.length,
      byStatus: [...byStatusMap.values()].sort((a, b) => b.count - a.count),
    },
    available,
    stockByModel,
    assetTypes: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    topModels: [...modelCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    topCategories: byCategory
      .map((c) => ({ category: c.category, count: c._count.id }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    dataSources: bySource
      .map((d) => ({ source: d.dataSource, count: d._count.id }))
      .sort((a, b) => b.count - a.count),
    repairsOpen,
    writeOffs,
    recentActivity,
    clubsWithAssets: clubCount,
  };
}

/** Detect when the user is asking for an in-stock model breakdown. */
export function wantsStockBreakdown(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("stock by model") || m.includes("models in stock")) return true;
  if (m.includes("breakdown") && (m.includes("stock") || m.includes("model"))) {
    return true;
  }
  if (
    (m.includes("in stock") || m.includes("available")) &&
    (m.includes("model") || m.includes("breakdown") || m.includes("what"))
  ) {
    return true;
  }
  if (
    (m.includes("csv") || m.includes("export") || m.includes("spreadsheet")) &&
    (m.includes("stock") || m.includes("model"))
  ) {
    return true;
  }
  return false;
}
