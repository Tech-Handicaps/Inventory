import { describe, expect, it } from "vitest";
import { UNKNOWN_BRAND, manufacturerBrand, modelForBrand } from "@/lib/inventory/manufacturer-brand";

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

describe("brand from model code", () => {
  it("names the brand from a model only one brand uses when the manufacturer is missing", () => {
    expect(manufacturerBrand("N/A", null, "PS-3316")).toBe("Posiflex");
    expect(manufacturerBrand(null, null, "NUC7CJYH")).toBe("Intel");
    expect(manufacturerBrand("", null, "Something")).toBe("Unknown");
  });

  it("prefers the recorded manufacturer over the model", () => {
    expect(manufacturerBrand("Dell Inc.", null, "PS-3316")).toBe("Dell");
  });

  it("drops a model that is only the brand name", () => {
    expect(modelForBrand("Mecer", "Mecer")).toBeNull();
    expect(modelForBrand("Mecer", "X22S")).toBe("X22S");
  });
});
