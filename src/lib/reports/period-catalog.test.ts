import { describe, expect, it } from "vitest";
import {
  anyNotesFirst,
  periodInfo,
  periodsThrough,
  previousMonthKey,
  sastMonthKey,
} from "@/lib/reports/period-catalog";

describe("period catalogue", () => {
  it("labels each period as the spec requires", () => {
    expect(periodInfo("2025-11").title).toBe("Prior-company count, quantities only (no serials)");
    expect(periodInfo("2026-01").title).toBe("Prior-company count, 31 Jan 2026");
    for (const key of ["2026-02", "2026-03", "2026-04"]) {
      const period = periodInfo(key);
      expect(period.title).toBe(
        "Stock held by Albatros – no count or reporting provided – carried forward from 31 Jan 2026 count"
      );
      expect(period.isMonthEndCount).toBe(false);
      expect(period.watermark).toContain("carried forward from 31 Jan 2026");
    }
    expect(periodInfo("2026-04").detail).toContain("18 Apr 2026");
    expect(periodInfo("2026-05").title).toContain("No count taken; stock confirmed by Finance against the 31 Jan 2026 Albatros count");
    expect(periodInfo("2026-06").watermark).toBe("No count on record – carried forward from 31 Jan 2026");
    expect(periodInfo("2026-08").title).toBe("Pack emailed, not stored");
    expect(periodInfo("2026-10").kind).toBe("system_pack");
    expect(periodInfo("2027-03").kind).toBe("system_pack");
  });

  it("puts the Notes page first only for periods before October 2026", () => {
    expect(periodInfo("2026-09").notesFirst).toBe(true);
    expect(periodInfo("2026-10").notesFirst).toBe(false);
    expect(anyNotesFirst(["2026-10", "2026-11"])).toBe(false);
    expect(anyNotesFirst(["2026-09", "2026-10"])).toBe(true);
  });

  it("lists periods from October 2025 and works out the SAST month", () => {
    expect(periodsThrough("2026-10")).toHaveLength(13);
    expect(sastMonthKey(new Date("2026-10-31T22:30:00.000Z"))).toBe("2026-11");
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });
});
