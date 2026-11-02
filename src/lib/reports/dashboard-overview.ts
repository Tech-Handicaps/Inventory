import { prisma } from "@/lib/prisma";
import { cachedInventoryStat } from "@/lib/cache/inventory-stats";
import { displayAssetModel } from "@/lib/inventory/asset-hardware-display";
import {
  UNKNOWN_BRAND,
  manufacturerBrand,
  modelForBrand,
} from "@/lib/inventory/manufacturer-brand";
import {
  classifyReportAssetType,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";
import {
  summariseOverview,
  type OverviewAsset,
  type DashboardOverview,
} from "@/lib/reports/dashboard-overview-summary";

export type { DashboardOverview };

async function computeDashboardOverview(): Promise<DashboardOverview> {
  const [statuses, rows] = await Promise.all([
    prisma.assetStatus.findMany({
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true },
    }),
    prisma.asset.findMany({
      select: {
        manufacturer: true,
        model: true,
        category: true,
        tags: true,
        dataSource: true,
        serialNumber: true,
        deviceLocation: true,
        clubId: true,
        dateAdded: true,
        purchaseDate: true,
        warrantyEndDate: true,
        status: { select: { code: true } },
        deviceTemplate: { select: { manufacturer: true, model: true } },
      },
    }),
  ]);

  const assets: OverviewAsset[] = rows.map((a) => {
    const rawModel = displayAssetModel(a);
    const brand = manufacturerBrand(
      a.manufacturer,
      a.deviceTemplate?.manufacturer,
      rawModel,
    );
    return {
      statusCode: a.status.code,
      brand,
      model: modelForBrand(brand, rawModel),
      type: classifyReportAssetType(a.category, a.tags) as ReportAssetTypeId,
      category: a.category,
      dataSource: a.dataSource,
      hasSerial: Boolean(a.serialNumber?.trim()),
      location: a.deviceLocation,
      hasClub: Boolean(a.clubId),
      dateAdded: a.dateAdded,
      purchaseDate: a.purchaseDate,
      warrantyEndDate: a.warrantyEndDate,
    };
  });

  return summariseOverview(assets, statuses, new Date(), UNKNOWN_BRAND);
}

/** Every Overview and Fleet figure from one read of the register, so they reconcile with All assets. */
export const loadDashboardOverview = cachedInventoryStat(
  "dashboard-overview-v3",
  computeDashboardOverview,
);
