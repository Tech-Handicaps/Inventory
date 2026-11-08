import { prisma } from "@/lib/prisma";
import { cachedInventoryStat } from "@/lib/cache/inventory-stats";
import { displayAssetModel } from "@/lib/inventory/asset-hardware-display";
import { applyAlias, buildAliasMap } from "@/lib/inventory/model-aliases";
import {
  UNKNOWN_BRAND,
  manufacturerBrand,
  modelForBrand,
} from "@/lib/inventory/manufacturer-brand";
import {
  classifyReportAssetType,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";
import { DATA_QUALITY_FOLLOW_UPS } from "@/lib/reports/data-quality-follow-ups";
import {
  summariseOverview,
  type OverviewAsset,
  type DashboardOverview,
} from "@/lib/reports/dashboard-overview-summary";

export type { DashboardOverview };

async function computeDashboardOverview(): Promise<DashboardOverview> {
  const [statuses, rows, aliasRows, followUpRows] = await Promise.all([
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
        geoCountryCode: true,
        dateAdded: true,
        purchaseDate: true,
        warrantyEndDate: true,
        status: { select: { code: true } },
        deviceTemplate: { select: { manufacturer: true, model: true } },
      },
    }),
    prisma.modelAlias.findMany({ select: { kind: true, alias: true, canonical: true } }),
    prisma.asset.findMany({
      where: { assetName: { in: DATA_QUALITY_FOLLOW_UPS.map((f) => f.assetName) } },
      select: { assetName: true },
    }),
  ]);
  const present = new Set(followUpRows.map((r) => r.assetName));
  const followUps = DATA_QUALITY_FOLLOW_UPS.filter((f) => present.has(f.assetName));
  const aliases = buildAliasMap(aliasRows);

  const assets: OverviewAsset[] = rows.map((a) => {
    const rawModel = applyAlias(aliases, "model", displayAssetModel(a));
    const brand = manufacturerBrand(
      applyAlias(aliases, "manufacturer", a.manufacturer),
      applyAlias(aliases, "manufacturer", a.deviceTemplate?.manufacturer),
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
      hasGeo: Boolean(a.geoCountryCode?.trim()),
      dateAdded: a.dateAdded,
      purchaseDate: a.purchaseDate,
      warrantyEndDate: a.warrantyEndDate,
    };
  });

  return { ...summariseOverview(assets, statuses, new Date(), UNKNOWN_BRAND), followUps };
}

/** Every Overview and Fleet figure from one read of the register, so they reconcile with All assets. */
export const loadDashboardOverview = cachedInventoryStat(
  "dashboard-overview-v5",
  computeDashboardOverview,
);
