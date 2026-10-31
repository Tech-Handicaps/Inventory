import { matchesAssetSearch, type AssetSearchFields } from "@/lib/inventory/asset-search";
import {
  displayAssetManufacturer,
  displayAssetModel,
} from "@/lib/inventory/asset-hardware-display";
import { isPlaceholderValue, normaliseManufacturer } from "@/lib/inventory/template-duplicates";
import {
  classifyReportAssetType,
  reportAssetTypeLabel,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";

export type BoardFilterAsset = AssetSearchFields & {
  club?: { id: string; name: string } | null;
  deviceTemplate?: {
    label: string;
    manufacturer?: string | null;
    model?: string | null;
  } | null;
  purchaseDate?: string | null;
  warrantyEndDate?: string | null;
};

export const MISSING_DATA_KEYS = ["warranty", "purchase", "club", "serial"] as const;
export type MissingDataKey = (typeof MISSING_DATA_KEYS)[number];

export const MISSING_DATA_LABELS: Record<MissingDataKey, string> = {
  warranty: "No warranty date",
  purchase: "No purchase date",
  club: "No club",
  serial: "No serial",
};

export const NO_CLUB = "__none__";

export type BoardFilters = {
  /** Club id, NO_CLUB, or "" for all. */
  club: string;
  type: ReportAssetTypeId | "";
  /** normaliseManufacturer() key. */
  manufacturer: string;
  /** Lower-cased model. */
  model: string;
  search: string;
  missing: MissingDataKey[];
};

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  club: "",
  type: "",
  manufacturer: "",
  model: "",
  search: "",
  missing: [],
};

export function hasActiveBoardFilters(f: BoardFilters): boolean {
  return Boolean(
    f.club || f.type || f.manufacturer || f.model || f.search.trim() || f.missing.length
  );
}

export function manufacturerKey(asset: BoardFilterAsset): string {
  const raw = displayAssetManufacturer(asset);
  return raw && !isPlaceholderValue(raw) ? normaliseManufacturer(raw) : "";
}

export function modelKey(asset: BoardFilterAsset): string {
  const raw = displayAssetModel(asset);
  return raw && !isPlaceholderValue(raw) ? raw.trim().toLowerCase() : "";
}

export function isMissing(asset: BoardFilterAsset, key: MissingDataKey): boolean {
  switch (key) {
    case "warranty":
      return !asset.warrantyEndDate;
    case "purchase":
      return !asset.purchaseDate;
    case "club":
      return !asset.club;
    case "serial":
      return !asset.serialNumber?.trim();
  }
}

/** Every filter must match (AND). */
export function matchesBoardFilters(asset: BoardFilterAsset, f: BoardFilters): boolean {
  if (f.club === NO_CLUB && asset.club) return false;
  if (f.club && f.club !== NO_CLUB && asset.club?.id !== f.club) return false;
  if (f.type && classifyReportAssetType(asset.category, asset.tags) !== f.type) return false;
  if (f.manufacturer && manufacturerKey(asset) !== f.manufacturer) return false;
  if (f.model && modelKey(asset) !== f.model) return false;
  if (f.missing.some((key) => !isMissing(asset, key))) return false;
  return matchesAssetSearch(asset, f.search);
}

export type FilterOption = { value: string; label: string; count: number };

function tally(
  assets: BoardFilterAsset[],
  keyOf: (a: BoardFilterAsset) => string,
  labelOf: (a: BoardFilterAsset) => string
): FilterOption[] {
  const byKey = new Map<string, { labels: Map<string, number>; count: number }>();
  for (const a of assets) {
    const key = keyOf(a);
    if (!key) continue;
    const entry = byKey.get(key) ?? { labels: new Map(), count: 0 };
    entry.count += 1;
    const label = labelOf(a);
    entry.labels.set(label, (entry.labels.get(label) ?? 0) + 1);
    byKey.set(key, entry);
  }
  return [...byKey.entries()]
    .map(([value, { labels, count }]) => ({
      value,
      // Show the spelling most assets use, e.g. "Dell" over "Dell Inc.".
      label: [...labels.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]![0],
      count,
    }))
    .sort((x, y) => x.label.localeCompare(y.label));
}

export function boardFilterOptions(assets: BoardFilterAsset[], f: BoardFilters) {
  const clubs = tally(
    assets,
    (a) => a.club?.id ?? "",
    (a) => a.club?.name ?? ""
  );
  const noClubCount = assets.filter((a) => !a.club).length;
  const types = tally(
    assets,
    (a) => classifyReportAssetType(a.category, a.tags),
    (a) => reportAssetTypeLabel(classifyReportAssetType(a.category, a.tags))
  );
  const manufacturers = tally(assets, manufacturerKey, (a) => displayAssetManufacturer(a) ?? "");
  const modelSource = f.manufacturer
    ? assets.filter((a) => manufacturerKey(a) === f.manufacturer)
    : assets;
  const models = tally(modelSource, modelKey, (a) => displayAssetModel(a) ?? "");
  return { clubs, noClubCount, types, manufacturers, models };
}
