export type GeoFromIp = {
  countryCode: string;
  regionCode: string | null;
  /** e.g. "Western Cape" from ip-api `regionName` or ipapi `region` */
  regionName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.|$)){4}$/;

type IpApiFields = {
  status: string;
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
};

type IpApiCoFields = {
  error?: boolean;
  reason?: string;
  country_code?: string;
  region_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * HTTPS first (works in stricter hosting / no cleartext HTTP), then ip-api.com HTTP.
 * @see https://ip-api.com/docs/ — free HTTP JSON
 * @see https://ipapi.co/api/ — free HTTPS, 1000/day without key
 */
export async function lookupGeoFromPublicIp(
  ip: string | null | undefined
): Promise<GeoFromIp | null> {
  if (!ip?.trim()) return null;
  const t = ip.trim();
  if (t === "0.0.0.0" || t === "127.0.0.1" || !IPV4.test(t)) return null;

  const fromCo = await lookupIpApiCo(t);
  if (fromCo) return fromCo;

  const fromCom = await lookupIpApiCom(t);
  if (fromCom) return fromCom;

  return null;
}

/** ipapi.co — HTTPS, no API key for basic fields. */
async function lookupIpApiCo(ip: string): Promise<GeoFromIp | null> {
  try {
    const res = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as IpApiCoFields;
    if (j.error === true || j.reason === "Reserved IP") return null;
    const cc = j.country_code?.trim();
    if (!cc) return null;
    const regionCode = j.region_code?.trim() || null;
    const regionName = j.region?.trim() || null;
    const city = j.city?.trim() || null;
    return {
      countryCode: cc.toUpperCase(),
      regionCode,
      regionName,
      city,
      latitude: typeof j.latitude === "number" ? j.latitude : null,
      longitude: typeof j.longitude === "number" ? j.longitude : null,
    };
  } catch {
    return null;
  }
}

/** ip-api.com — HTTP JSON (free). Some environments block cleartext; use as fallback. */
async function lookupIpApiCom(ip: string): Promise<GeoFromIp | null> {
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,lat,lon`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as IpApiFields;
    if (j.status !== "success" || !j.countryCode) return null;
    const rc = j.region?.trim() || null;
    const rn = j.regionName?.trim() || null;
    return {
      countryCode: j.countryCode,
      regionCode: rc,
      regionName: rn,
      city: j.city?.trim() || null,
      latitude: typeof j.lat === "number" ? j.lat : null,
      longitude: typeof j.lon === "number" ? j.lon : null,
    };
  } catch {
    return null;
  }
}

/** Prisma fields derived from current public IP (clears geo when lookup fails or IP cleared). */
export async function prismaGeoFieldsFromPublicIp(
  publicIp: string | null | undefined
): Promise<{
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  geoSyncedAt: Date | null;
}> {
  const geo = await lookupGeoFromPublicIp(publicIp);
  if (!geo) {
    return {
      geoCountryCode: null,
      geoRegionCode: null,
      geoRegionName: null,
      geoCity: null,
      geoSyncedAt: null,
    };
  }
  return {
    geoCountryCode: geo.countryCode,
    geoRegionCode: geo.regionCode,
    geoRegionName: geo.regionName,
    geoCity: geo.city,
    geoSyncedAt: new Date(),
  };
}
