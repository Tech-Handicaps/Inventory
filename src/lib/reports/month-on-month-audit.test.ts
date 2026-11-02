import { describe, expect, it } from "vitest";
import { buildLegacyMonthEndDrafts } from "@/lib/reports/legacy-month-end";
import {
  buildMonthOnMonthAudit,
  liveMonthFromAssets,
} from "@/lib/reports/month-on-month-audit";

const audit = buildMonthOnMonthAudit(buildLegacyMonthEndDrafts());

function month(key: string) {
  const found = audit.months.find((row) => row.monthKey === key);
  if (!found) throw new Error(key);
  return found;
}

describe("month-on-month audit", () => {
  it("covers every archived month from October 2025 through June 2026", () => {
    expect(audit.months.map((row) => row.monthKey)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    expect(month("2025-10").delta).toBeNull();
    expect(month("2025-10").totals.units).toBe(130);
    expect(month("2025-11").totals.units).toBe(132);
  });

  it("records the November increase and the January line changes", () => {
    expect(month("2025-11").delta).toMatchObject({
      newStock: 0,
      repairedUsed: 0,
      toAssess: 2,
      units: 2,
    });
    expect(month("2025-12").delta).toMatchObject({ units: 0, toAssess: 0 });
    expect(month("2026-01").delta).toMatchObject({ units: 0 });
    expect(month("2026-03").delta).toMatchObject({ units: 0 });
    expect(month("2026-03").movementNote).toContain("31 Jan 2026");

    expect(audit.movements).toEqual([
      expect.objectContaining({
        toMonthKey: "2025-11",
        model: "OptiPlex 7440",
        column: "To assess",
        previous: 1,
        current: 2,
        delta: 1,
      }),
      expect.objectContaining({
        toMonthKey: "2025-11",
        model: "PS-3316E",
        column: "To assess",
        previous: 0,
        current: 1,
        delta: 1,
      }),
      expect.objectContaining({ toMonthKey: "2026-01", model: "OptiPlex 3050", previous: 1, current: 3 }),
      expect.objectContaining({ toMonthKey: "2026-01", model: "OptiPlex 7440", previous: 2, current: 1 }),
      expect.objectContaining({ toMonthKey: "2026-01", model: "PS-3316E", previous: 1, current: 0 }),
    ]);
    expect(audit.movements.map((row) => row.model)).not.toContain("UST-TP01");
    expect(audit.stockBreakdowns.map((block) => block.monthKey)).toEqual([
      "2025-10",
      "2025-11",
      "2026-01",
    ]);
    const newStock = audit.stockBreakdowns[0]?.columns.find(
      (column) => column.field === "newStock"
    );
    expect(newStock?.lines[0]).toMatchObject({
      model: "Card Reader Bracket",
      quantity: 32,
    });
  });

  it("explains the workbooks, the carried-forward months, and the live register boundary", () => {
    const text = audit.explanation.join(" ");
    expect(text).toContain("October 2025");
    expect(text).toContain("31 January 2026");
    expect(text).toContain("stock held by Albatros");
    expect(text).toContain("hand-over");
    expect(text).toContain("not a month-end count");
    expect(text).toContain("OptiPlex 7440");
    expect(text).toContain("PS-3316E");
    expect(text).toContain("UST-TP01");
    expect(text).toContain("does not include the live register");
    expect(audit.months.at(-1)?.monthKey).toBe("2026-06");
  });

  it("dates the live register in the Johannesburg month", () => {
    const live = liveMonthFromAssets(
      [
        { status: { code: "new_stock" } },
        { status: { code: "deployed" } },
        { status: { code: "written_off" } },
      ],
      new Date("2026-10-08T08:00:00.000Z")
    );
    expect(live.monthKey).toBe("2026-10");
    expect(live.newStock).toBe(1);
    expect(live.deployed).toBe(1);
    expect(live.writtenOff).toBe(1);
  });
});
