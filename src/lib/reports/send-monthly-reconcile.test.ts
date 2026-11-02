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

import { officialPackAction } from "@/lib/reports/send-monthly-reconcile";

describe("official pack action", () => {
  it("generates, stores and sends a month once on the schedule", () => {
    expect(officialPackAction({ mode: "cron", packStored: false, sentBefore: false })).toBe("generate_and_send");
    expect(officialPackAction({ mode: "cron", packStored: true, sentBefore: true })).toBe("skip_already_sent");
  });

  it("retries the email from the stored files when the send failed", () => {
    expect(officialPackAction({ mode: "cron", packStored: true, sentBefore: false })).toBe("send_stored");
  });

  it("treats months emailed before packs were stored as sent", () => {
    expect(officialPackAction({ mode: "cron", packStored: false, sentBefore: true })).toBe("skip_already_sent");
  });

  it("lets an admin send now or resend without regenerating a stored month", () => {
    expect(officialPackAction({ mode: "send_now", packStored: false, sentBefore: false })).toBe("generate_and_send");
    expect(officialPackAction({ mode: "send_now", packStored: true, sentBefore: true })).toBe("refuse_already_stored");
    expect(officialPackAction({ mode: "resend", packStored: true, sentBefore: true })).toBe("send_stored");
    expect(officialPackAction({ mode: "resend", packStored: false, sentBefore: false })).toBe("refuse_not_stored");
  });

  it("closes October on 2 November, not September", () => {
    expect(reconcileReportMonth("cron", new Date("2026-11-02T06:00:00.000Z")).monthKey).toBe("2026-10");
  });
});
