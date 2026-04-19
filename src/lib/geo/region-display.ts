/**
 * GeoIP returns region as a short code (e.g. WC). Map known ZA codes to readable names for labels.
 * @see geoip-lite city DB subdivision codes for South Africa
 */
const ZA_REGION_NAMES: Record<string, string> = {
  EC: "Eastern Cape",
  FS: "Free State",
  GT: "Gauteng",
  NL: "KwaZulu-Natal",
  LP: "Limpopo",
  MP: "Mpumalanga",
  NC: "Northern Cape",
  NW: "North West",
  WC: "Western Cape",
};

export function formatGeoLabel(
  countryCode: string | null | undefined,
  regionCode: string | null | undefined,
  city: string | null | undefined,
  regionName?: string | null | undefined
): string {
  const cc = countryCode?.trim();
  const rc = regionCode?.trim();
  const rn = regionName?.trim();
  const c = city?.trim();
  if (!cc && !rc && !rn && !c) return "—";
  const parts: string[] = [];
  if (cc === "ZA" && rc && ZA_REGION_NAMES[rc]) {
    parts.push(ZA_REGION_NAMES[rc]);
  } else if (rn) {
    parts.push(rn);
  } else if (rc) {
    parts.push(rc);
  }
  if (c && !parts.includes(c)) parts.push(c);
  if (cc) parts.push(cc);
  return parts.filter(Boolean).join(" · ");
}

export function regionNameForCode(
  countryCode: string | null | undefined,
  regionCode: string | null | undefined,
  regionName?: string | null | undefined
): string | null {
  if (countryCode === "ZA" && regionCode && ZA_REGION_NAMES[regionCode]) {
    return ZA_REGION_NAMES[regionCode];
  }
  const rn = regionName?.trim();
  if (rn) return rn;
  return regionCode ?? null;
}
