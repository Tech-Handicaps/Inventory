import { isIP } from "node:net";
import path from "node:path";
import { Reader, type City, type ReaderModel } from "@maxmind/geoip2-node";

export type GeoFromIp = {
  countryCode: string;
  regionCode: string | null;
  /** e.g. "Western Cape" */
  regionName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Written by `scripts/fetch-geolite.mjs` at build time and bundled only into the routes listed in
 * `next.config.ts`. Kept out of static analysis so the file tracer doesn't copy it into every
 * function that imports this module.
 */
export const GEOLITE_CITY_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "geoip",
  "GeoLite2-City.mmdb"
);

let readerPromise: Promise<ReaderModel | null> | null = null;

function cityReader(): Promise<ReaderModel | null> {
  readerPromise ??= Reader.open(GEOLITE_CITY_PATH).catch((e: unknown) => {
    console.warn(
      "GeoLite2-City database could not be opened; geolocation is off",
      e instanceof Error ? e.message : e
    );
    return null;
  });
  return readerPromise;
}

const PRIVATE_V4: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10 carrier-grade NAT
  [0x7f000000, 8], // 127/8
  [0xa9fe0000, 16], // 169.254/16
  [0xac100000, 12], // 172.16/12
  [0xc0a80000, 16], // 192.168/16
  [0xe0000000, 3], // 224/3 multicast + reserved
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

/** True for loopback, private, link-local, CGNAT and other non-routable addresses. */
export function isNonPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const n = v4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => n >>> (32 - bits) === base >>> (32 - bits));
  }
  if (kind === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isNonPublicIp(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd]/.test(lower) || // fc00::/7 unique local
      /^fe[89ab]/.test(lower) // fe80::/10 link-local
    );
  }
  return true;
}

/** Client IP of an incoming request: first `x-forwarded-for` entry, then `x-real-ip`. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

export function geoFromCityRecord(r: City): GeoFromIp | null {
  const countryCode = r.country?.isoCode ?? r.registeredCountry?.isoCode;
  if (!countryCode) return null;
  const sub = r.subdivisions?.[0];
  return {
    countryCode: countryCode.toUpperCase(),
    regionCode: sub?.isoCode ?? null,
    regionName: sub?.names.en ?? null,
    city: r.city?.names.en ?? null,
    latitude: r.location?.latitude ?? null,
    longitude: r.location?.longitude ?? null,
  };
}

type Lookup = { geo: GeoFromIp | null; databaseMissing: boolean };

async function lookup(ip: string | null | undefined): Promise<Lookup> {
  const t = ip?.trim();
  if (!t || !isIP(t) || isNonPublicIp(t)) return { geo: null, databaseMissing: false };
  const reader = await cityReader();
  if (!reader) return { geo: null, databaseMissing: true };
  try {
    return { geo: geoFromCityRecord(reader.city(t)), databaseMissing: false };
  } catch {
    return { geo: null, databaseMissing: false };
  }
}

/** Local GeoLite2 lookup. Null for private/invalid IPs, unknown addresses, or a missing database; never throws. */
export async function lookupGeoFromPublicIp(
  ip: string | null | undefined
): Promise<GeoFromIp | null> {
  return (await lookup(ip)).geo;
}

type PrismaGeoFields = {
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  geoSyncedAt: Date | null;
};

/**
 * Prisma fields derived from current public IP (clears geo when the IP is cleared or not found).
 * Returns no fields when the database is missing, so a bad deploy can't wipe stored locations.
 */
export async function prismaGeoFieldsFromPublicIp(
  publicIp: string | null | undefined
): Promise<PrismaGeoFields | Record<string, never>> {
  const { geo, databaseMissing } = await lookup(publicIp);
  if (databaseMissing) return {};
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
