import type { ReportAssetTypeId } from "@/lib/reports/asset-types";
import type { DataQualityFollowUp } from "@/lib/reports/data-quality-follow-ups";

/** Below this share of units with the underlying data, a stat is muted and says "based on N units". */
export const COVERAGE_THRESHOLD = 0.5;

/** Assist fills location with this default; it says nothing about where the unit is. */
export const PLACEHOLDER_LOCATIONS = new Set(["my department"]);

/** Same wording as the KPI cards, so the stage bar and the cards never disagree. */
export const STAGE_LABELS: Record<string, string> = {
  new_stock: "New stock",
  deployed: "Deployed",
  assessment: "Assessment",
  repair: "In repair",
  refurbished: "Refurbished",
  written_off: "Written off",
};

const AVAILABLE_CODES = new Set(["new_stock", "refurbished"]);
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_YEAR = 365.25 * MS_DAY;
const TOP_SKU_COUNT = 7;

export type OverviewAsset = {
  statusCode: string;
  brand: string;
  model: string | null;
  type: ReportAssetTypeId;
  category: string;
  dataSource: string;
  hasSerial: boolean;
  location: string | null;
  hasClub: boolean;
  dateAdded: Date;
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

export type ModelRow = { brand: string; model: string; inUse: number; writtenOff: number; total: number };

export type FleetInsights = {
  /** Every unit except written off; the base for age, warranty and share figures. */
  inUse: number;
  writtenOff: number;
  brandsInUse: number;
  topBrand: { name: string; share: number } | null;
  topThreeModelsShare: number;
  /** Same brand + model grouping as Overview, over all units, split in use / written off. */
  models: ModelRow[];
  noModel: { inUse: number; writtenOff: number };
  purchaseDates: { have: number; of: number };
  warrantyDates: { have: number; of: number };
  warranty: { active: number; expiring90: number; expired: number };
  byRegistrationYear: { year: number; count: number }[];
  byPurchaseYear: { year: number; count: number }[];
  addedLast24MonthsPct: number;
};

export type DashboardOverview = {
  /** Named records waiting on a decision (added by the loader). */
  followUps?: DataQualityFollowUp[];
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
  fleet: FleetInsights;
  categories: { category: string; count: number }[];
  dataSources: { dataSource: string; count: number }[];
};

function coverage(value: number | null, basedOn: number, of: number): CoverageStat {
  return { value, basedOn, of, lowCoverage: of === 0 || basedOn / of < COVERAGE_THRESHOLD };
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function countBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

function yearSeries(dates: Date[]) {
  return [...countBy(dates, (d) => String(d.getUTCFullYear()))]
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);
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
  const byStatus = countBy(assets, (a) => a.statusCode);
  const stages = statuses.map((s) => ({
    code: s.code,
    label: STAGE_LABELS[s.code] ?? s.label,
    count: byStatus.get(s.code) ?? 0,
  }));
  for (const [code, count] of byStatus) {
    if (!statuses.some((s) => s.code === code)) stages.push({ code, label: STAGE_LABELS[code] ?? code, count });
  }

  const availableByType: Record<ReportAssetTypeId, number> = { hardware: 0, usb_hid_msr: 0, other: 0 };
  for (const a of assets) if (AVAILABLE_CODES.has(a.statusCode)) availableByType[a.type] += 1;

  const manufacturers = [...countBy(assets, (a) => a.brand)]
    .map(([name, count]) => ({ name, count }))
    .sort((x, y) => (x.name === unknownBrand ? 1 : y.name === unknownBrand ? -1 : y.count - x.count || x.name.localeCompare(y.name)));

  const byModel = new Map<string, ModelRow>();
  const noModel = { inUse: 0, writtenOff: 0 };
  for (const a of assets) {
    const off = a.statusCode === "written_off";
    if (!a.model) {
      noModel[off ? "writtenOff" : "inUse"] += 1;
      continue;
    }
    const key = `${a.brand}\u0000${a.model.toLowerCase()}`;
    const row = byModel.get(key) ?? { brand: a.brand, model: a.model, inUse: 0, writtenOff: 0, total: 0 };
    row[off ? "writtenOff" : "inUse"] += 1;
    row.total += 1;
    byModel.set(key, row);
  }
  const models = [...byModel.values()].sort((x, y) => y.total - x.total || x.model.localeCompare(y.model));

  const inUse = assets.filter((a) => a.statusCode !== "written_off");
  const withPurchase = inUse.filter((a) => a.purchaseDate);
  const withWarranty = inUse.filter((a) => a.warrantyEndDate);
  const avgAge = withPurchase.length
    ? withPurchase.reduce((sum, a) => sum + (now.getTime() - a.purchaseDate!.getTime()) / MS_YEAR, 0) /
      withPurchase.length
    : null;
  const warranty = { active: 0, expiring90: 0, expired: 0 };
  for (const a of withWarranty) {
    const diff = a.warrantyEndDate!.getTime() - now.getTime();
    if (diff < 0) warranty.expired += 1;
    else {
      warranty.active += 1;
      if (diff <= 90 * MS_DAY) warranty.expiring90 += 1;
    }
  }

  const inUseBrands = [...countBy(inUse, (a) => a.brand)].filter(([name]) => name !== unknownBrand).sort((x, y) => y[1] - x[1]);
  const inUseModels = models.map((m) => m.inUse).sort((x, y) => y - x);

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
    topSkus: models.slice(0, TOP_SKU_COUNT).map((m) => ({ brand: m.brand, model: m.model, count: m.total })),
    distinctModels: models.length,
    dataQuality,
    operational: inUse.length,
    averageAgeYears: coverage(avgAge, withPurchase.length, inUse.length),
    warrantyExpiring90Days: coverage(withWarranty.length ? warranty.expiring90 : null, withWarranty.length, inUse.length),
    fleet: {
      inUse: inUse.length,
      writtenOff: assets.length - inUse.length,
      brandsInUse: inUseBrands.length,
      topBrand: inUseBrands[0] ? { name: inUseBrands[0][0], share: pct(inUseBrands[0][1], inUse.length) } : null,
      topThreeModelsShare: pct(inUseModels.slice(0, 3).reduce((s, n) => s + n, 0), inUse.length),
      models,
      noModel,
      purchaseDates: { have: withPurchase.length, of: inUse.length },
      warrantyDates: { have: withWarranty.length, of: inUse.length },
      warranty,
      byRegistrationYear: yearSeries(inUse.map((a) => a.dateAdded)),
      byPurchaseYear: yearSeries(withPurchase.map((a) => a.purchaseDate!)),
      addedLast24MonthsPct: pct(inUse.filter((a) => now.getTime() - a.dateAdded.getTime() <= 730 * MS_DAY).length, inUse.length),
    },
    categories: [...countBy(assets, (a) => a.category || "Uncategorised")]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    dataSources: [...countBy(assets, (a) => a.dataSource)].map(([dataSource, count]) => ({ dataSource, count })),
  };
}
