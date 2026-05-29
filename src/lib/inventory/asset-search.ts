import { formatGeoLabel } from "@/lib/geo/region-display";

/**
 * Minimal shape for client-side inventory search (board, registry, lifecycle picker).
 * Any object with these fields can be passed — extra properties are ignored.
 */
export type AssetSearchFields = {
  assetName: string;
  serialNumber: string | null;
  category: string;
  manufacturer: string | null;
  model: string | null;
  deviceTemplate?: { label: string } | null;
  club?: { name: string } | null;
  deviceLocation: string | null;
  reason: string | null;
  zohoAssistDeviceId: string | null;
  /** e.g. zoho_assist | manual — searchable as text */
  dataSource?: string | null;
  publicIp: string | null;
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  processorName: string | null;
  systemRam: string | null;
  systemGpu: string | null;
  status: { label: string; code: string };
  assessments?: { referenceNumber: string }[];
};

/** Lowercased searchable blob; tokens are matched with AND semantics in `matchesAssetSearch`. */
export function assetSearchText(asset: AssetSearchFields): string {
  const geo = formatGeoLabel(
    asset.geoCountryCode,
    asset.geoRegionCode,
    asset.geoCity,
    asset.geoRegionName
  );
  const intakeRef = asset.assessments?.[0]?.referenceNumber;
  const src =
    typeof asset.dataSource === "string" && asset.dataSource.trim()
      ? asset.dataSource
      : "";
  return [
    asset.assetName,
    asset.serialNumber,
    asset.category,
    asset.manufacturer,
    asset.model,
    asset.deviceTemplate?.label,
    asset.club?.name,
    asset.deviceLocation,
    asset.reason,
    asset.zohoAssistDeviceId,
    asset.publicIp,
    geo !== "—" ? geo : "",
    asset.processorName,
    asset.systemRam,
    asset.systemGpu,
    intakeRef,
    asset.status.label,
    asset.status.code,
    src,
  ]
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    .join(" ")
    .toLowerCase();
}

/** Each whitespace-separated token must appear somewhere in the haystack (AND). */
export function matchesAssetSearch(
  asset: AssetSearchFields,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = assetSearchText(asset);
  return q.split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}
