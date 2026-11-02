import { describe, expect, it } from "vitest";
import { applyAlias, breaksLenovoRule, buildAliasMap } from "@/lib/inventory/model-aliases";

describe("model aliases", () => {
  const map = buildAliasMap([
    { kind: "model", alias: "PS-3316E", canonical: "PS-3316" },
    { kind: "model", alias: "Dell 3050", canonical: "OptiPlex 3050" },
    { kind: "model", alias: "MSR205HK", canonical: "MSR250HK" },
    { kind: "model", alias: "M810z", canonical: "10Q0S0CU00" },
  ]);

  it("maps spellings case-insensitively and leaves others alone", () => {
    expect(applyAlias(map, "model", "ps-3316e")).toBe("PS-3316");
    expect(applyAlias(map, "model", "DELL  3050")).toBe("OptiPlex 3050");
    expect(applyAlias(map, "model", "MSR205HK")).toBe("MSR250HK");
    expect(applyAlias(map, "model", "X22S")).toBe("X22S");
    expect(applyAlias(map, "model", null)).toBeNull();
  });

  it("never merges Lenovo M810z with 10Q0", () => {
    expect(breaksLenovoRule("M810z", "10Q0S0CU00")).toBe(true);
    expect(breaksLenovoRule("10Q0S09P00", "Lenovo M810z")).toBe(true);
    expect(breaksLenovoRule("10Q0S09P00", "10Q0")).toBe(false);
    expect(applyAlias(map, "model", "M810z")).toBe("M810z");
  });
});
