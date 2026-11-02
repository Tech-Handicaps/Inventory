import { describe, expect, it } from "vitest";
import { buildDifferenceBreakdown, PRIOR_COUNT_LEFT, type StockAsset } from "@/lib/reports/difference-breakdown";

const asset = (statusCode: string, text: string, label = text): StockAsset => ({ statusCode, family: text, text, label });

/** The register on 2 Nov 2026: 115 Deployed + 10 new and 1 refurbished Posiflex + 7 Gigatek readers + 3 written off. */
const notDeployed: StockAsset[] = [
  ...Array.from({ length: 10 }, (_, i) => asset("new_stock", "PosiFlex PS-3316", `PSN${i}`)),
  asset("refurbished", "PosiFlex PS-3316", "PSM70592"),
  ...Array.from({ length: 7 }, (_, i) => asset("new_stock", "Gigatek MSR250HK", `1221${i}`)),
  asset("written_off", "MECER X22S-T", "George"),
  asset("written_off", "Mustek6376 MST6376 Mecer", "HNA-SPRNGBK-01"),
  asset("written_off", "Dell Inc. OptiPlex 5270 AIO", "HNA-EASTLONDN-01"),
];

describe("buildDifferenceBreakdown", () => {
  it("leaves 43 items from the 31 Jan 2026 count after modems and brackets", () => {
    expect(PRIOR_COUNT_LEFT.reduce((s, l) => s + l.count, 0)).toBe(132 - 57 - 32);
  });

  it("explains the -22 in full, with nothing left over", () => {
    const d = buildDifferenceBreakdown({
      difference: 136 - (132 - 57 - 32 + 115),
      priorLeft: 43,
      addedLines: 115,
      writtenOffLines: 0,
      deployed: 115,
      notDeployed,
    });
    const by = Object.fromEntries(d.parts.map((p) => [p.reason, p.quantity]));
    expect(by).toEqual({
      computer_not_captured: -9,
      disposed_by_voucher: -2,
      monitor_not_captured: -1,
      reader_not_captured: -13,
      written_off_after_capture: 3,
    });
    expect(d.parts.reduce((s, p) => s + p.quantity, 0)).toBe(-22);
    expect(d.inRegister).toEqual(["11 × Posiflex PS-3316 (new)", "7 × Gigatek MSR250HK card reader"]);
  });

  it("shows any remainder as not yet explained instead of hiding it", () => {
    const d = buildDifferenceBreakdown({
      difference: -20,
      priorLeft: 45,
      addedLines: 115,
      writtenOffLines: 0,
      deployed: 115,
      notDeployed,
    });
    const rest = d.parts.find((p) => p.reason === "not_explained");
    expect(rest?.quantity).toBe(2);
    expect(rest?.note).toContain("45");
  });

  it("separates Deployed units added since the bridge line was set", () => {
    const d = buildDifferenceBreakdown({
      difference: -21,
      priorLeft: 43,
      addedLines: 115,
      writtenOffLines: 0,
      deployed: 116,
      notDeployed,
    });
    expect(d.parts.find((p) => p.reason === "deployed_vs_line")?.quantity).toBe(1);
    expect(d.parts.find((p) => p.reason === "not_explained")).toBeUndefined();
  });
});
