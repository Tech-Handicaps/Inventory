import { describe, expect, it, vi } from "vitest";
import type { City } from "@maxmind/geoip2-node";

vi.mock("@maxmind/geoip2-node", () => ({
  Reader: { open: vi.fn(() => Promise.reject(new Error("ENOENT"))) },
}));

import {
  clientIpFromHeaders,
  geoFromCityRecord,
  isNonPublicIp,
  lookupGeoFromPublicIp,
  lookupProviderFromPublicIp,
  NO_PROVIDER,
  prismaGeoFieldsFromPublicIp,
  providerFromAsnRecord,
} from "./lookup-ip";
import { internetProviderLabel } from "./region-display";

describe("isNonPublicIp", () => {
  it.each(["10.1.2.3", "172.20.0.1", "192.168.1.10", "127.0.0.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1", "not-an-ip"])(
    "%s is not public",
    (ip) => expect(isNonPublicIp(ip)).toBe(true)
  );

  it.each(["8.8.8.8", "41.0.0.1", "172.32.0.1", "2001:4860:4860::8888"])("%s is public", (ip) =>
    expect(isNonPublicIp(ip)).toBe(false)
  );
});

describe("clientIpFromHeaders", () => {
  it("takes the first x-forwarded-for entry", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "41.1.2.3, 10.0.0.1" }))).toBe("41.1.2.3");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "8.8.4.4" }))).toBe("8.8.4.4");
  });

  it("ignores values that are not IPs", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "unknown" }))).toBeNull();
  });
});

describe("geoFromCityRecord", () => {
  it("maps MaxMind fields to the stored shape", () => {
    const record = {
      country: { isoCode: "ZA", names: { en: "South Africa" } },
      subdivisions: [{ isoCode: "WC", names: { en: "Western Cape" } }],
      city: { names: { en: "Cape Town" } },
      location: { latitude: -33.9, longitude: 18.4 },
    } as unknown as City;
    expect(geoFromCityRecord(record)).toEqual({
      countryCode: "ZA",
      regionCode: "WC",
      regionName: "Western Cape",
      city: "Cape Town",
      latitude: -33.9,
      longitude: 18.4,
    });
  });

  it("falls back to the registered country and returns null with no country", () => {
    expect(geoFromCityRecord({ registeredCountry: { isoCode: "US" } } as unknown as City)?.countryCode).toBe("US");
    expect(geoFromCityRecord({} as City)).toBeNull();
  });
});

describe("lookups without a database", () => {
  it("return null for private and public IPs without throwing", async () => {
    await expect(lookupGeoFromPublicIp("192.168.0.1")).resolves.toBeNull();
    await expect(lookupGeoFromPublicIp("8.8.8.8")).resolves.toBeNull();
  });

  it("leave stored geo untouched when the database is missing", async () => {
    await expect(prismaGeoFieldsFromPublicIp("8.8.8.8")).resolves.toEqual({});
  });

  it("still clear geo when the IP is cleared", async () => {
    await expect(prismaGeoFieldsFromPublicIp(null)).resolves.toMatchObject({ geoCountryCode: null, geoSyncedAt: null });
  });

  it("return NO_PROVIDER for private and public IPs", async () => {
    await expect(lookupProviderFromPublicIp("10.0.0.5")).resolves.toEqual(NO_PROVIDER);
    await expect(lookupProviderFromPublicIp("8.8.8.8")).resolves.toEqual(NO_PROVIDER);
  });

  it("stamp an empty provider for a private IP so it isn't looked up again", async () => {
    const fields = await prismaGeoFieldsFromPublicIp("192.168.1.10");
    expect(fields).toMatchObject({ ispName: null, ispAsn: null });
    expect(fields.ispUpdatedAt).toBeInstanceOf(Date);
  });
});

describe("providerFromAsnRecord", () => {
  it("maps the organisation and AS number", () => {
    expect(
      providerFromAsnRecord({ autonomousSystemNumber: 37611, autonomousSystemOrganization: "  Afrihost (Pty) Ltd " })
    ).toEqual({ name: "Afrihost (Pty) Ltd", asn: 37611 });
  });

  it("drops a missing or invalid AS number and an empty name", () => {
    expect(providerFromAsnRecord({})).toEqual(NO_PROVIDER);
    expect(providerFromAsnRecord({ autonomousSystemNumber: 0, autonomousSystemOrganization: "X" })).toEqual({ name: "X", asn: null });
  });

  it("caps the name at 120 characters", () => {
    expect(providerFromAsnRecord({ autonomousSystemOrganization: "a".repeat(200) }).name).toHaveLength(120);
  });
});

describe("internetProviderLabel", () => {
  it("formats name and AS number", () => {
    expect(internetProviderLabel("Vodacom", 29975)).toBe("Vodacom (AS29975)");
    expect(internetProviderLabel("Vodacom", null)).toBe("Vodacom");
    expect(internetProviderLabel(null, 29975)).toBe("");
  });
});
