import { describe, expect, it } from "vitest";
import { LEGACY_STOCK_SKUS } from "@/lib/reports/legacy-month-end-catalog";
import {
  buildLegacyMonthEndDrafts,
  CARRIED_FORWARD_MONTHS,
  composeLegacyColumn,
  summarizeLegacyLines,
} from "@/lib/reports/legacy-month-end";

function month(key: string) {
  const found = buildLegacyMonthEndDrafts().find((row) => row.monthKey === key);
  if (!found) throw new Error(key);
  return found;
}

function qty(
  key: string,
  skuKey: string,
  field: "newStock" | "repairedUsed" | "toAssess"
) {
  const line = month(key).lines.find((row) =>
    LEGACY_STOCK_SKUS[row.sortOrder]?.key === skuKey
  );
  if (!line) throw new Error(skuKey);
  return line[field];
}

describe("legacy month-end stock", () => {
  it("archives Oct–Dec 2025 from the workbooks and carries December through March 2026", () => {
    const drafts = buildLegacyMonthEndDrafts();
    expect(drafts.map((row) => row.monthKey)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      ...CARRIED_FORWARD_MONTHS,
    ]);
    expect(month("2025-10").sourceKind).toBe("source_file");
    expect(month("2025-10").sourceFileName).toContain("20251031");
    expect(month("2026-03").sourceKind).toBe("carried_forward");
    expect(month("2026-03").carriedForwardFromMonthKey).toBe("2025-12");
    expect(buildLegacyMonthEndDrafts().some((row) => row.monthKey === "2026-04")).toBe(
      false
    );
  });

  it("matches the October workbook totals", () => {
    expect(summarizeLegacyLines(month("2025-10").lines)).toMatchObject({
      newStock: 53,
      repairedUsed: 26,
      toAssess: 51,
      toDispose: 0,
      warrantyRepair: 0,
      usable: 79,
      potentialUsable: 130,
      units: 130,
    });
    expect(month("2025-10").notes).toContain("UST-TP01");
    expect(month("2025-10").notes).toContain("Posiflex");
  });

  it("applies the November movements and keeps December identical", () => {
    expect(qty("2025-10", "dell-optiplex-7440", "toAssess")).toBe(1);
    expect(qty("2025-11", "dell-optiplex-7440", "toAssess")).toBe(2);
    expect(qty("2025-10", "posiflex-ps-3316e", "toAssess")).toBe(0);
    expect(qty("2025-11", "posiflex-ps-3316e", "newStock")).toBe(11);
    expect(qty("2025-11", "posiflex-ps-3316e", "toAssess")).toBe(1);
    expect(qty("2025-10", "mecer-ust-tp01", "newStock")).toBe(0);
    expect(qty("2025-11", "mecer-ust-tp01", "newStock")).toBe(0);
    expect(qty("2025-11", "mecer-ust-tp01", "toAssess")).toBe(0);

    expect(summarizeLegacyLines(month("2025-11").lines)).toMatchObject({
      newStock: 53,
      repairedUsed: 26,
      toAssess: 53,
      units: 132,
    });
    expect(summarizeLegacyLines(month("2025-12").lines)).toEqual(
      summarizeLegacyLines(month("2025-11").lines)
    );
    expect(summarizeLegacyLines(month("2026-03").lines)).toEqual(
      summarizeLegacyLines(month("2025-12").lines)
    );
  });

  it("breaks new stock into the models that make up the 53", () => {
    const composed = composeLegacyColumn(month("2025-10").lines, "newStock");
    expect(composed.total).toBe(53);
    expect(composed.lines.map((line) => [line.model, line.quantity])).toEqual([
      ["Card Reader Bracket", 32],
      ["PS-3316E", 11],
      ["MSR250HK", 7],
      ["R219z", 2],
      ["BOXSTK1AW32SC", 1],
    ]);
    expect(composed.groupTotals[0]).toEqual({
      groupLabel: "Accessories",
      quantity: 32,
    });
    const repaired = composeLegacyColumn(month("2025-10").lines, "repairedUsed");
    expect(repaired.total).toBe(26);
    expect(repaired.lines[0]).toMatchObject({ model: "K3565-Rev 2", quantity: 16 });
    expect(composed.lines.reduce((sum, line) => sum + line.quantity, 0)).toBe(
      composed.total
    );
  });

  it("classifies terminals, swipe readers, and modems into separate finance buckets", () => {
    const lines = month("2025-12").lines;
    const byModel = Object.fromEntries(
      lines.map((line) => [line.model, line.financeType])
    );
    expect(byModel["PS-3316E"]).toBe("hardware");
    expect(byModel["LE22BW"]).toBe("hardware");
    expect(byModel["21040108"]).toBe("usb_hid_msr");
    expect(byModel["MSR213U"]).toBe("usb_hid_msr");
    expect(byModel["E3131"]).toBe("other");
    expect(byModel["DWR-932M"]).toBe("other");
    expect(byModel["Card Reader Bracket"]).toBe("other");
    expect(byModel["UST-TP01"]).toBe("other");
  });
});
