import type { ReportAssetTypeId } from "@/lib/reports/asset-types";

/** Below this share of units with the underlying data, a stat is muted and says "based on N units". */
export const COVERAGE_THRESHOLD = 0.5;

/** Assist fills location with this default; it says nothing about where the unit is. */
export const PLACEHOLDER_LOCATIONS = new Set(["my department"]);

const AVAILABLE_CODES = new Set(["new_stock", "refurbished"]);
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_YEAR = 365.25 * MS_DAY;
const TOP_SKU_COUNT = 7;

export type OverviewAsset = {
  statusCode: string;
  brand: string;
  model: string | null;
  type: ReportAssetTypeId;
  hasSerial: boolean;
  location: string | null;
  hasClub: boolean;
  purchaseDate: Date | null;
  warrantyEndDate: Date | null;
};

export type CoverageStat = {
  value: number | null;
  basedOn: number;
  of: number;
  lowCoverage: boolean;
};

export type DataQualityItem = {
  key: "purchase" | "warranty" | "location" | "serial" | "club";
  label: string;
  have: number;
  of: number;
};

export type DashboardOverview = {
  total: number;
  stages: { code: string; label: string; count: number }[];
  kpis: {
    total: number;
    deployed: number;
    available: number;
    availableByType: Record<ReportAssetTypeId, number>;
    inRepair: number;
    writtenOff: number;
  };
  /** Every unit appears in exactly one slice, so slices add up to `total`. */
  manufacturers: { name: string; count: number }[];
  topSkus: { brand: string; model: string; count: number }[];
  distinctModels: number;
  dataQuality: DataQualityItem[];
  operational: number;
  averageAgeYears: CoverageStat;
  warrantyExpiring90Days: CoverageStat;
};

function coverage(value: number | null, basedOn: number, of: number): CoverageStat {
  return { value, basedOn, of, lowCoverage: of === 0 || basedOn / of < COVERAGE_THRESHOLD };
}

export function hasRealLocation(location: string | null): boolean {
  const v = location?.trim().toLowerCase();
  return Boolean(v) && !PLACEHOLDER_LOCATIONS.has(v!);
}

export function summariseOverview(
  assets: OverviewAsset[],
  statuses: { code: string; label: string }[],
  now: Date,
  unknownBrand: string
): DashboardOverview {
  const byStatus = new Map<string, number>();
  for (const a of assets) byStatus.set(a.statusCode, (byStatus.get(a.statusCode) ?? 0) + 1);
  const stages = statuses.map((s) => ({ code: s.code, label: s.label, count: byStatus.get(s.code) ?? 0 }));
  for (const [code, count] of byStatus) {
    if (!statuses.some((s) => s.code === code)) stages.push({ code, label: code, count });
  }

  const availableByType: Record<ReportAssetTypeId, number> = { hardware: 0, usb_hid_msr: 0, other: 0 };
  for (const a of assets) if (AVAILABLE_CODES.has(a.statusCode)) availableByType[a.type] += 1;

  const byBrand = new Map<string, number>();
  for (const a of assets) byBrand.set(a.brand, (byBrand.get(a.brand) ?? 0) + 1);
  const manufacturers = [...byBrand]
    .map(([name, count]) => ({ name, count }))
    .sort((x, y) => (x.name === unknownBrand ? 1 : y.name === unknownBrand ? -1 : y.count - x.count || x.name.localeCompare(y.name)));

  const bySku = new Map<string, { brand: string; model: string; count: number }>();
  for (const a of assets) {
    if (!a.model) continue;
    const key = `${a.brand}\u0000${a.model.toLowerCase()}`;
    const row = bySku.get(key) ?? { brand: a.brand, model: a.model, count: 0 };
    row.count += 1;
    bySku.set(key, row);
  }
  const skus = [...bySku.values()].sort((x, y) => y.count - x.count || x.model.localeCompare(y.model));

  const operational = assets.filter((a) => a.statusCode !== "written_off");
  const withPurchase = operational.filter((a) => a.purchaseDate);
  const withWarranty = operational.filter((a) => a.warrantyEndDate);
  const avgAge = withPurchase.length
    ? withPurchase.reduce((sum, a) => sum + (now.getTime() - a.purchaseDate!.getTime()) / MS_YEAR, 0) /
      withPurchase.length
    : null;
  const expiring = withWarranty.filter((a) => {
    const diff = a.warrantyEndDate!.getTime() - now.getTime();
    return diff >= 0 && diff <= 90 * MS_DAY;
  }).length;

  const deployed = assets.filter((a) => a.statusCode === "deployed");
  const dataQuality: DataQualityItem[] = [
    { key: "purchase", label: "have a purchase date", have: assets.filter((a) => a.purchaseDate).length, of: assets.length },
    { key: "warranty", label: "have a warranty end date", have: assets.filter((a) => a.warrantyEndDate).length, of: assets.length },
    { key: "location", label: "have a real location (not “My Department”)", have: assets.filter((a) => hasRealLocation(a.location)).length, of: assets.length },
    { key: "serial", label: "have a serial number", have: assets.filter((a) => a.hasSerial).length, of: assets.length },
    { key: "club", label: "deployed units have a club", have: deployed.filter((a) => a.hasClub).length, of: deployed.length },
  ];

  return {
    total: assets.length,
    stages,
    kpis: {
      total: assets.length,
      deployed: byStatus.get("deployed") ?? 0,
      available: availableByType.hardware + availableByType.usb_hid_msr + availableByType.other,
      availableByType,
      inRepair: byStatus.get("repair") ?? 0,
      writtenOff: byStatus.get("written_off") ?? 0,
    },
    manufacturers,
    topSkus: skus.slice(0, TOP_SKU_COUNT),
    distinctModels: skus.length,
    dataQuality,
    operational: operational.length,
    averageAgeYears: coverage(avgAge, withPurchase.length, operational.length),
    warrantyExpiring90Days: coverage(withWarranty.length ? expiring : null, withWarranty.length, operational.length),
  };
}
