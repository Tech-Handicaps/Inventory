import { prisma } from "@/lib/prisma";
import {
  classifyReportAssetType,
  reportAssetTypeLabel,
} from "@/lib/reports/asset-types";
import { resolveAssetSkuModelLabel } from "@/lib/inventory/device-template-label";

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

  for (const a of assets) {
    const typeId = classifyReportAssetType(a.category, a.tags);
    typeCounts.set(
      reportAssetTypeLabel(typeId),
      (typeCounts.get(reportAssetTypeLabel(typeId)) ?? 0) + 1
    );

    const modelLabel = resolveAssetSkuModelLabel(a);
    modelCounts.set(modelLabel, (modelCounts.get(modelLabel) ?? 0) + 1);

    const code = a.status.code;
    if (code === "new_stock" || code === "refurbished") {
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
