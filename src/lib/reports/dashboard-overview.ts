import { prisma } from "@/lib/prisma";
import { displayAssetModel } from "@/lib/inventory/asset-hardware-display";
import { UNKNOWN_BRAND, manufacturerBrand } from "@/lib/inventory/manufacturer-brand";
import { classifyReportAssetType, type ReportAssetTypeId } from "@/lib/reports/asset-types";
import {
  summariseOverview,
  type OverviewAsset,
  type DashboardOverview,
} from "@/lib/reports/dashboard-overview-summary";

export type { DashboardOverview };

/** Every Overview figure from one read of the register, so they reconcile with All assets. */
export async function loadDashboardOverview(now = new Date()): Promise<DashboardOverview> {
  const [statuses, rows] = await Promise.all([
    prisma.assetStatus.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true, label: true } }),
    prisma.asset.findMany({
      select: {
        manufacturer: true,
        model: true,
        category: true,
        tags: true,
        serialNumber: true,
        deviceLocation: true,
        clubId: true,
        purchaseDate: true,
        warrantyEndDate: true,
        status: { select: { code: true } },
        deviceTemplate: { select: { manufacturer: true, model: true } },
      },
    }),
  ]);

  const assets: OverviewAsset[] = rows.map((a) => {
    const brand = manufacturerBrand(a.manufacturer, a.deviceTemplate?.manufacturer);
    return {
      statusCode: a.status.code,
      brand,
      model: displayAssetModel(a) ?? null,
      type: classifyReportAssetType(a.category, a.tags) as ReportAssetTypeId,
      hasSerial: Boolean(a.serialNumber?.trim()),
      location: a.deviceLocation,
      hasClub: Boolean(a.clubId),
      purchaseDate: a.purchaseDate,
      warrantyEndDate: a.warrantyEndDate,
    };
  });

  return summariseOverview(assets, statuses, now, UNKNOWN_BRAND);
}
