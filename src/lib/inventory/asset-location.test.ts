import { describe, expect, it } from "vitest";
import { assetLocation } from "@/lib/inventory/asset-location";

describe("assetLocation", () => {
  it("keeps a location typed on the asset", () => {
    expect(assetLocation({ deviceLocation: "Pro shop", club: { name: "PAROW GOLF CLUB" } })).toMatchObject({
      text: "Pro shop",
      kind: "typed",
    });
  });

  it("shows the club instead of the Assist placeholder", () => {
    expect(
      assetLocation({ deviceLocation: "My Department", club: { name: "PAROW GOLF CLUB" }, geoCity: "Cape Town" })
    ).toMatchObject({ text: "PAROW GOLF CLUB", kind: "club" });
  });

  it("falls back to the GeoIP city, marked approximate", () => {
    expect(assetLocation({ deviceLocation: "My Department", club: null, geoCountryCode: "ZA", geoCity: "Durban" })).toMatchObject({
      text: "≈ Durban",
      kind: "geo",
    });
  });

  it("uses the GeoIP region when there is no city", () => {
    expect(assetLocation({ deviceLocation: null, geoCountryCode: "ZA", geoRegionCode: "GT" })?.text).toMatch(/^≈ Gauteng/);
  });

  it("returns null when nothing is known", () => {
    expect(assetLocation({ deviceLocation: "My Department" })).toBeNull();
  });
});
