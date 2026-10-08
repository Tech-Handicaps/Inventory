import { describe, expect, it } from "vitest";
import { reconcileReportMonth } from "@/lib/reports/send-monthly-reconcile";

describe("reconcile report month", () => {
  it("closes the previous month when the scheduled run is on the 1st", () => {
    const firstOfOctober = new Date("2026-10-01T06:00:00.000Z");
    const official = reconcileReportMonth("cron", firstOfOctober);
    expect(official.monthKey).toBe("2026-09");
    expect(official.monthEndingLabel).toBe("For month ending September 2026");
    expect(official.monthKey).not.toBe("2026-10");
  });

  it("uses the month printed on the PDF, not the month the job runs", () => {
    const twentyEighthSeptember = new Date("2026-09-28T08:00:00.000Z");
    const official = reconcileReportMonth("cron", twentyEighthSeptember);
    expect(official.monthKey).toBe("2026-08");
    expect(official.monthEndingLabel).toBe("For month ending August 2026");
  });

  it("keeps a manual test on the current month and separate from the official file", () => {
    const firstOfOctober = new Date("2026-10-01T06:00:00.000Z");
    const test = reconcileReportMonth("manual_test", firstOfOctober);
    expect(test.monthKey).toBe("2026-10");
    expect(test.monthEndingLabel).toBe("For month ending October 2026");
    expect(test.monthKey).not.toBe(
      reconcileReportMonth("cron", firstOfOctober).monthKey
    );
  });

  it("closes December when the scheduled run is on 1 January", () => {
    const newYear = new Date("2027-01-01T06:00:00.000Z");
    expect(reconcileReportMonth("cron", newYear).monthKey).toBe("2026-12");
  });
});
