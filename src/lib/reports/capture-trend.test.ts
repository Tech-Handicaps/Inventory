import { describe, expect, it } from "vitest";
import { buildCaptureTrend, monthEnds, statusEventsFromAudit } from "@/lib/reports/capture-trend";

const d = (iso: string) => new Date(iso);

describe("monthEnds", () => {
  it("ends each month at 23:59:59.999 SAST and stops at the current month", () => {
    const ends = monthEnds("2026-04", d("2026-06-10T08:00:00Z"));
    expect(ends.map((e) => e.monthKey)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(ends[0].end.toISOString()).toBe("2026-04-30T21:59:59.999Z");
    expect(ends[2].end.toISOString()).toBe("2026-06-10T08:00:00.000Z");
  });
});

describe("statusEventsFromAudit", () => {
  it("reads creations and status changes and ignores other edits", () => {
    const events = statusEventsFromAudit([
      { actionType: "asset.imported_from_zoho_assist", timestamp: d("2026-05-01"), metadata: { assetId: "a" } },
      { actionType: "asset.updated", timestamp: d("2026-06-01"), metadata: { assetId: "a", changes: { statusCode: { from: "deployed", to: "repair" } } } },
      { actionType: "asset.updated", timestamp: d("2026-06-02"), metadata: { assetId: "a", changes: { model: { from: "MS-A95311", to: "AP190" } } } },
      { actionType: "asset.write_off", timestamp: d("2026-07-01"), metadata: { assetId: "b", fromStatusCode: "assessment" } },
      { actionType: "asset.created", timestamp: d("2026-04-20"), metadata: { assetId: "b", statusCode: "assessment" } },
    ]);
    expect(events).toEqual([
      { assetId: "a", at: d("2026-05-01"), kind: "created", to: "deployed" },
      { assetId: "a", at: d("2026-06-01"), kind: "change", from: "deployed", to: "repair" },
      { assetId: "b", at: d("2026-07-01"), kind: "change", from: "assessment", to: "written_off" },
      { assetId: "b", at: d("2026-04-20"), kind: "created", to: "assessment" },
    ]);
  });
});

describe("buildCaptureTrend", () => {
  it("works each month end back from today's status", () => {
    const assets = [
      { id: "a", statusCode: "deployed", dateAdded: d("2026-04-20"), hardware: true },
      { id: "b", statusCode: "repair", dateAdded: d("2026-05-10"), hardware: true },
      { id: "usb", statusCode: "deployed", dateAdded: d("2026-04-20"), hardware: false },
    ];
    const events = statusEventsFromAudit([
      { actionType: "asset.imported_from_zoho_assist", timestamp: d("2026-04-20T10:00:00Z"), metadata: { assetId: "a" } },
      { actionType: "asset.imported_from_zoho_assist", timestamp: d("2026-05-10T10:00:00Z"), metadata: { assetId: "b" } },
      { actionType: "asset.updated", timestamp: d("2026-06-15T10:00:00Z"), metadata: { assetId: "b", changes: { statusCode: { from: "deployed", to: "repair" } } } },
    ]);
    const trend = buildCaptureTrend(assets, events, { fromMonthKey: "2026-04", now: d("2026-06-20T10:00:00Z"), hnaOwned: 4 });
    expect(trend.points.map((p) => [p.monthKey, p.deployed, p.pct, p.toDate])).toEqual([
      ["2026-04", 1, 25, false],
      ["2026-05", 2, 50, false],
      ["2026-06", 1, 25, true],
    ]);
    expect(trend.unreconciled).toBe(0);
  });

  it("counts assets whose history does not lead back to their starting status", () => {
    const assets = [{ id: "a", statusCode: "repair", dateAdded: d("2026-04-20"), hardware: true }];
    const events = statusEventsFromAudit([
      { actionType: "asset.imported_from_zoho_assist", timestamp: d("2026-04-20"), metadata: { assetId: "a" } },
    ]);
    expect(buildCaptureTrend(assets, events, { fromMonthKey: "2026-04", now: d("2026-05-01"), hnaOwned: 1 }).unreconciled).toBe(1);
  });
});
