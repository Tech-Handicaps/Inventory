import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GEOLITE_ASN_PATH,
  lookupProviderFromPublicIp,
  NO_PROVIDER,
} from "./lookup-ip";

/** Runs against the real GeoLite2-ASN file after `npm run prebuild`; skipped where it isn't downloaded (CI). */
describe.skipIf(!existsSync(GEOLITE_ASN_PATH))("GeoLite2-ASN file", () => {
  it("finds the provider for a known IP", async () => {
    const provider = await lookupProviderFromPublicIp("8.8.8.8");
    expect(provider.asn).toBe(15169);
    expect(provider.name).toMatch(/google/i);
  });

  it("returns NO_PROVIDER for a private IP", async () => {
    await expect(lookupProviderFromPublicIp("192.168.0.1")).resolves.toEqual(NO_PROVIDER);
  });

  it("returns NO_PROVIDER for a public IP that isn't in the database", async () => {
    await expect(lookupProviderFromPublicIp("192.0.2.1")).resolves.toEqual(NO_PROVIDER);
  });
});
