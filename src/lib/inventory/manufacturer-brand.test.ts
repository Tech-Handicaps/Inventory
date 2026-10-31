import { describe, expect, it } from "vitest";
import { UNKNOWN_BRAND, manufacturerBrand } from "@/lib/inventory/manufacturer-brand";

describe("manufacturerBrand", () => {
  it("collapses spellings of the same OEM", () => {
    expect(manufacturerBrand("Dell Inc.")).toBe("Dell");
    expect(manufacturerBrand("DELL")).toBe("Dell");
    expect(manufacturerBrand("LENOVO")).toBe("Lenovo");
    expect(manufacturerBrand("PosiFlex")).toBe("Posiflex");
    expect(manufacturerBrand("Hewlett-Packard")).toBe("HP");
    expect(manufacturerBrand("Intel(R) Client Systems")).toBe("Intel");
    expect(manufacturerBrand("MICRO-STAR INTERNATIONAL CO., LTD")).toBe("MSI");
  });

  it("shows Mecer as the brand for Mustek-made units", () => {
    expect(manufacturerBrand("MECER")).toBe("Mecer");
    expect(manufacturerBrand("Mustek")).toBe("Mecer");
    expect(manufacturerBrand("Mustek6376 MST6376")).toBe("Mecer");
  });

  it("falls back to the template, then Unknown, for placeholders", () => {
    expect(manufacturerBrand("N/A", "PosiFlex")).toBe("Posiflex");
    expect(manufacturerBrand("empty", null)).toBe(UNKNOWN_BRAND);
    expect(manufacturerBrand(null, undefined)).toBe(UNKNOWN_BRAND);
  });

  it("title-cases brands it does not know", () => {
    expect(manufacturerBrand("acme widgets")).toBe("Acme Widgets");
  });
});
