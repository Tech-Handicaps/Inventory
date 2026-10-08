import { describe, expect, it } from "vitest";
import {
  buildLegacyMonthEndDrafts,
  summarizeLegacyLines,
} from "@/lib/reports/legacy-month-end";
import type { FinanceMonthPosition } from "@/lib/reports/finance-month-on-month";
import { buildFinanceYearly } from "@/lib/reports/finance-yearly";

function decemberInput() {
  const december = buildLegacyMonthEndDrafts().find((draft) => draft.monthKey === "2025-12");
  if (!december) throw new Error("December draft missing");
  return {
    monthKey: december.monthKey,
    sourceFileName: december.sourceFileName,
    sourceKind: december.sourceKind,
    totals: summarizeLegacyLines(december.lines),
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
    expect(report.finance2026.closed).toBe(false);
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
        position("2026-12", "For month ending December 2026", 20, 140),
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
