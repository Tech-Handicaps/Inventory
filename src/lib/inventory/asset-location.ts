import { formatGeoLabel } from "@/lib/geo/region-display";
import { hasRealLocation } from "@/lib/reports/dashboard-overview-summary";

export type AssetLocationSource = {
  deviceLocation: string | null;
  club?: { name: string } | null;
  geoCountryCode?: string | null;
  geoRegionCode?: string | null;
  geoRegionName?: string | null;
  geoCity?: string | null;
};

export type AssetLocation = {
  text: string;
  /** typed = entered on the asset; club = confirmed club; geo = approximate, from the public IP. */
  kind: "typed" | "club" | "geo";
  tip: string;
};

/**
 * What to show as an asset's location. Zoho Assist fills deviceLocation with "My Department", which says
 * nothing, so fall back to the confirmed club, then to the GeoIP city or region, marked as approximate.
 */
export function assetLocation(a: AssetLocationSource): AssetLocation | null {
  if (hasRealLocation(a.deviceLocation)) {
    return { text: a.deviceLocation!.trim(), kind: "typed", tip: "Location recorded on the asset" };
  }
  const club = a.club?.name?.trim();
  if (club) return { text: club, kind: "club", tip: "Confirmed club location" };
  const city = a.geoCity?.trim();
  const geo = city || formatGeoLabel(a.geoCountryCode, a.geoRegionCode, null, a.geoRegionName);
  if (geo && geo !== "—") {
    return {
      text: `≈ ${geo}`,
      kind: "geo",
      tip: "Approximate location from the unit's internet address (GeoIP). Not a confirmed site.",
    };
  }
  return null;
}
