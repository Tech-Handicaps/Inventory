import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

describe("formatDate", () => {
  it("uses DD Mon YYYY in Johannesburg time", () => {
    expect(formatDate("2026-04-18T10:00:00Z")).toBe("18 Apr 2026");
    expect(formatDate(new Date("2026-09-05T00:00:00Z"))).toBe("05 Sep 2026");
  });

  it("rolls to the next day after 22:00 UTC", () => {
    expect(formatDate("2026-10-31T22:30:00Z")).toBe("01 Nov 2026");
  });

  it("returns the fallback for missing or invalid values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not a date", "")).toBe("");
  });
});

describe("formatDateTime", () => {
  it("adds 24-hour SAST time", () => {
    expect(formatDateTime("2026-04-18T12:05:00Z")).toBe("18 Apr 2026 14:05 SAST");
    expect(formatDateTime("2026-01-01T22:00:00Z")).toBe("02 Jan 2026 00:00 SAST");
  });
});
