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
  it("archives Oct 2025–Jan 2026 from the workbooks and carries 31 Jan through June 2026", () => {
    const drafts = buildLegacyMonthEndDrafts();
    expect(drafts.map((row) => row.monthKey)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      ...CARRIED_FORWARD_MONTHS,
    ]);
    expect(month("2025-10").sourceKind).toBe("source_file");
    expect(month("2025-10").sourceFileName).toContain("20251031");
    expect(month("2026-01").sourceKind).toBe("source_file");
    expect(month("2026-01").sourceFileName).toContain("20260131");
    expect(month("2026-03").sourceKind).toBe("carried_forward");
    expect(month("2026-03").carriedForwardFromMonthKey).toBe("2026-01");
    expect(month("2026-03").notes).toContain("Stock held by Albatros");
    expect(month("2026-05").sourceKind).toBe("handover");
    expect(month("2026-06").sourceKind).toBe("no_count");
    expect(drafts.some((row) => row.monthKey === "2026-07")).toBe(false);
  });

  it("imports the real January lines, not a December copy", () => {
    expect(qty("2026-01", "dell-optiplex-3050", "toAssess")).toBe(3);
    expect(qty("2026-01", "dell-optiplex-7440", "toAssess")).toBe(1);
    expect(qty("2026-01", "posiflex-ps-3316e", "toAssess")).toBe(0);
    expect(summarizeLegacyLines(month("2026-01").lines)).toMatchObject({
      newStock: 53,
      repairedUsed: 26,
      toAssess: 53,
      units: 132,
    });
    expect(summarizeLegacyLines(month("2026-06").lines)).toEqual(
      summarizeLegacyLines(month("2026-01").lines)
    );
  });

  it("keeps the dongle as a memo line copying Posiflex, outside every total", () => {
    const dongle = (key: string) =>
      month(key).lines.find((row) => row.model === "UST-TP01");
    const units = (key: string) => {
      const line = dongle(key);
      return line ? line.newStock + line.repairedUsed + line.toAssess : -1;
    };
    expect([units("2025-10"), units("2025-11"), units("2025-12"), units("2026-01")]).toEqual([
      11, 12, 12, 11,
    ]);
    expect(dongle("2025-12")?.memo).toBe(true);
    expect(summarizeLegacyLines(month("2025-12").lines).units).toBe(132);
    expect(
      composeLegacyColumn(month("2025-12").lines, "newStock").lines.map((line) => line.model)
    ).not.toContain("UST-TP01");
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

    expect(summarizeLegacyLines(month("2025-11").lines)).toMatchObject({
      newStock: 53,
      repairedUsed: 26,
      toAssess: 53,
      units: 132,
    });
    expect(summarizeLegacyLines(month("2025-12").lines)).toEqual(
      summarizeLegacyLines(month("2025-11").lines)
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
