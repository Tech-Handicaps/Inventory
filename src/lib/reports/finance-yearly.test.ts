import { describe, expect, it } from "vitest";
import {
  buildLegacyMonthEndDrafts,
  summarizeLegacyLines,
} from "@/lib/reports/legacy-month-end";
import type { FinanceMonthPosition, FinanceTypeTotals } from "@/lib/reports/finance-month-on-month";
import { buildFinanceYearly } from "@/lib/reports/finance-yearly";

function decemberInput() {
  const december = buildLegacyMonthEndDrafts().find((draft) => draft.monthKey === "2025-12");
  if (!december) throw new Error("December draft missing");
  return {
    monthKey: december.monthKey,
    sourceFileName: december.sourceFileName,
    sourceKind: december.sourceKind,
    totals: summarizeLegacyLines(december.lines),
    lines: december.lines,
  };
}

function typeRow(
  assetType: FinanceTypeTotals["assetType"],
  label: string,
  usable: number,
  register: number
): FinanceTypeTotals {
  return {
    assetType,
    label,
    newStock: usable,
    refurbished: 0,
    usable,
    deployed: register - usable,
    assessment: 0,
    inRepair: 0,
    writtenOff: 0,
    register,
  };
}

function position(
  monthKey: string,
  label: string,
  usable: number,
  register: number
): FinanceMonthPosition {
  return {
    monthKey,
    monthEndingLabel: label,
    newStock: usable,
    refurbished: 0,
    usable,
    deployed: register - usable,
    assessment: 0,
    inRepair: 0,
    writtenOff: 0,
    register,
    lines: [],
    types: [],
  };
}

function positionWithTypes(
  monthKey: string,
  label: string,
  types: FinanceTypeTotals[]
): FinanceMonthPosition {
  const usable = types
    .filter((row) => row.assetType !== "other")
    .reduce((sum, row) => sum + row.usable, 0);
  const register = types
    .filter((row) => row.assetType !== "other")
    .reduce((sum, row) => sum + row.register, 0);
  return {
    ...position(monthKey, label, usable, register),
    newStock: usable,
    types,
  };
}

describe("finance yearly", () => {
  it("keeps 2025 as the December workbook and leaves 2026 empty until a pack is stored", () => {
    const report = buildFinanceYearly({
      december2025: decemberInput(),
      financePositions: [],
    });
    expect(report.introduction[0]).toBe(
      "Each year is its own block. The blocks are not subtracted."
    );
    expect(report.workbook2025).toMatchObject({
      year: "2025",
      monthKey: "2025-12",
      newStock: 53,
      repairedUsed: 26,
      usable: 79,
      toAssess: 53,
      units: 132,
    });
    expect(report.workbook2025?.basis).toContain("December 2025 workbook");
    expect(report.introduction.join(" ")).toContain("terminals, monitors, PC sticks");
    expect(report.introduction.join(" ")).toContain("outside the closing row");
    const groups = report.workbook2025?.groups ?? [];
    expect(groups.map((row) => row.groupLabel)).toEqual([
      "Terminals",
      "Monitors",
      "PC Sticks",
      "Modems",
      "Card Readers",
      "Accessories",
    ]);
    expect(groups.find((row) => row.groupLabel === "Accessories")?.newStock).toBe(32);
    expect(groups.find((row) => row.groupLabel === "Terminals")?.newStock).toBe(11);
    expect(groups.find((row) => row.groupLabel === "Card Readers")?.newStock).toBe(7);
    expect(groups.find((row) => row.groupLabel === "Modems")?.newStock).toBe(2);
    expect(groups.find((row) => row.groupLabel === "PC Sticks")?.newStock).toBe(1);
    expect(groups.find((row) => row.groupLabel === "Monitors")?.newStock).toBe(0);
    expect(groups.reduce((sum, row) => sum + row.newStock, 0)).toBe(53);
    expect(groups.reduce((sum, row) => sum + row.repairedUsed, 0)).toBe(26);
    expect(groups.reduce((sum, row) => sum + row.toAssess, 0)).toBe(53);
    expect(groups.reduce((sum, row) => sum + row.units, 0)).toBe(132);
    expect(report.introduction.join(" ")).not.toContain("make and model");
    expect(report.finance2026.closed).toBe(false);
    expect(report.finance2026.typeBlocks).toEqual([]);
    expect(report.finance2026.closing).toBeNull();
    expect(report.finance2026.months).toEqual([]);
    expect(report.finance2026.basis).toContain("2026 is not closed");
    expect(report.finance2026.basis).toContain("None has been kept yet");
    expect(JSON.stringify(report)).not.toMatch(/yearChange|combined|subtracted from/);
  });

  it("uses the latest stored 2026 pack and does not subtract it from December", () => {
    const report = buildFinanceYearly({
      december2025: decemberInput(),
      financePositions: [
        positionWithTypes("2026-12", "For month ending December 2026", [
          typeRow("hardware", "Hardware", 18, 130),
          typeRow("usb_hid_msr", "USB HID Magnetic Stripe Readers", 2, 10),
          typeRow("other", "Other / uncategorized", 0, 0),
        ]),
        position("2026-10", "For month ending October 2026", 19, 135),
        position("2025-12", "For month ending December 2025", 1, 1),
      ],
    });
    expect(report.finance2026.closed).toBe(true);
    expect(report.finance2026.closing).toMatchObject({
      monthKey: "2026-12",
      usable: 20,
      register: 140,
    });
    const types = report.finance2026.closing?.types ?? [];
    expect(types.map((row) => row.assetType)).toEqual(["hardware", "usb_hid_msr", "other"]);
    expect(
      types
        .filter((row) => row.assetType !== "other")
        .reduce((sum, row) => sum + row.register, 0)
    ).toBe(140);
    expect(report.finance2026.typeBlocks.map((block) => block.assetType)).toEqual([
      "hardware",
      "usb_hid_msr",
      "other",
    ]);
    expect(report.finance2026.typeNote).toContain("outside that row");
    expect(report.finance2026.months.map((month) => month.monthKey)).toEqual([
      "2026-10",
      "2026-12",
    ]);
    expect(report.finance2026.months[1].usableChange).toBe(1);
    expect(report.workbook2025?.units).toBe(132);
    expect(report.finance2026.basis).toContain("not subtracted");
  });

  it("says 2026 is still open when the latest stored month is not December", () => {
    const report = buildFinanceYearly({
      december2025: decemberInput(),
      financePositions: [
        position("2026-10", "For month ending October 2026", 19, 135),
      ],
    });
    expect(report.finance2026.closed).toBe(false);
    expect(report.finance2026.closing?.monthKey).toBe("2026-10");
    expect(report.finance2026.basis).toContain("2026 is not closed");
    expect(report.finance2026.basis).toContain("not subtracted");
    expect(report.finance2026.months[0].usableChange).toBeNull();
  });
});
