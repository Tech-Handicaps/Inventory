import { isIP } from "node:net";
import path from "node:path";
import { Reader, type Asn, type City, type ReaderModel } from "@maxmind/geoip2-node";

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

/** Same build-time download as City; internet provider (autonomous system) per IP. */
export const GEOLITE_ASN_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "geoip",
  "GeoLite2-ASN.mmdb"
);

const readers = new Map<string, Promise<ReaderModel | null>>();

function openReader(file: string, offMessage: string): Promise<ReaderModel | null> {
  let p = readers.get(file);
  if (!p) {
    p = Reader.open(file).catch((e: unknown) => {
      console.warn(offMessage, e instanceof Error ? e.message : e);
      return null;
    });
    readers.set(file, p);
  }
  return p;
}

const cityReader = () =>
  openReader(GEOLITE_CITY_PATH, "GeoLite2-City database could not be opened; geolocation is off");
const asnReader = () =>
  openReader(GEOLITE_ASN_PATH, "GeoLite2-ASN database could not be opened; internet provider lookup is off");

type ReaderLookup<T> = { value: T; databaseMissing: boolean };

/** Shared path for every GeoLite2 edition: `empty` for private/invalid/unknown IPs and read errors. */
async function lookupWith<T>(
  ip: string | null | undefined,
  open: () => Promise<ReaderModel | null>,
  map: (reader: ReaderModel, ip: string) => T,
  empty: T
): Promise<ReaderLookup<T>> {
  const t = ip?.trim();
  if (!t || !isIP(t) || isNonPublicIp(t)) return { value: empty, databaseMissing: false };
  const reader = await open();
  if (!reader) return { value: empty, databaseMissing: true };
  try {
    return { value: map(reader, t), databaseMissing: false };
  } catch (e) {
    if (!(e instanceof Error && e.name === "AddressNotFoundError")) {
      console.warn("GeoLite2 lookup failed", e instanceof Error ? e.message : e);
    }
    return { value: empty, databaseMissing: false };
  }
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

const lookupGeo = (ip: string | null | undefined) =>
  lookupWith<GeoFromIp | null>(ip, cityReader, (r, t) => geoFromCityRecord(r.city(t)), null);

/** Local GeoLite2 lookup. Null for private/invalid IPs, unknown addresses, or a missing database; never throws. */
export async function lookupGeoFromPublicIp(
  ip: string | null | undefined
): Promise<GeoFromIp | null> {
  return (await lookupGeo(ip)).value;
}

/** Registered owner of the network an IP belongs to — often, not always, the ISP brand. */
export type InternetProvider = { name: string; asn: number | null };

export const NO_PROVIDER: InternetProvider = { name: "", asn: null };

const ISP_NAME_MAX = 120;

export function providerFromAsnRecord(r: Pick<Asn, "autonomousSystemNumber" | "autonomousSystemOrganization">): InternetProvider {
  const asn = r.autonomousSystemNumber;
  return {
    name: (r.autonomousSystemOrganization ?? "").trim().slice(0, ISP_NAME_MAX),
    asn: typeof asn === "number" && Number.isInteger(asn) && asn > 0 ? asn : null,
  };
}

const lookupProvider = (ip: string | null | undefined) =>
  lookupWith<InternetProvider>(ip, asnReader, (r, t) => providerFromAsnRecord(r.asn(t)), NO_PROVIDER);

/** Local GeoLite2-ASN lookup; NO_PROVIDER for private/invalid/unknown IPs or a missing database. Never throws. */
export async function lookupProviderFromPublicIp(
  ip: string | null | undefined
): Promise<InternetProvider> {
  return (await lookupProvider(ip)).value;
}

type PrismaGeoFields = {
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  geoSyncedAt: Date | null;
};

type PrismaIspFields = {
  ispName: string | null;
  ispAsn: number | null;
  ispUpdatedAt: Date;
};

/**
 * Prisma fields derived from the current public IP: GeoIP location plus internet provider.
 * Location is cleared when the IP is cleared or not found; the provider is stamped even when
 * nothing is found. Each part is left out when its database is missing, so a bad deploy can't
 * wipe stored values.
 */
export async function prismaGeoFieldsFromPublicIp(
  publicIp: string | null | undefined
): Promise<Partial<PrismaGeoFields & PrismaIspFields>> {
  const [geoLookup, providerLookup] = await Promise.all([
    lookupGeo(publicIp),
    lookupProvider(publicIp),
  ]);

  const isp: Partial<PrismaIspFields> = providerLookup.databaseMissing
    ? {}
    : {
        ispName: providerLookup.value.name || null,
        ispAsn: providerLookup.value.asn,
        ispUpdatedAt: new Date(),
      };

  if (geoLookup.databaseMissing) return isp;
  const geo = geoLookup.value;
  if (!geo) {
    return {
      geoCountryCode: null,
      geoRegionCode: null,
      geoRegionName: null,
      geoCity: null,
      geoSyncedAt: null,
      ...isp,
    };
  }
  return {
    geoCountryCode: geo.countryCode,
    geoRegionCode: geo.regionCode,
    geoRegionName: geo.regionName,
    geoCity: geo.city,
    geoSyncedAt: new Date(),
    ...isp,
  };
}
