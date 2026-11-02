import { describe, expect, it } from "vitest";
import { buildAuditorIndex } from "@/lib/reports/auditor-index";

const index = buildAuditorIndex();
const text = [
  ...index.paragraphs,
  ...index.serviceDeskDiscrepancies,
  ...index.entries.flatMap((entry) => [entry.title, entry.covers]),
].join(" ");

describe("auditor index", () => {
  it("states the periods, the hand-over and that the series are not added", () => {
    expect(text).toContain("31 January 2026");
    expect(text).toContain("Albatros held the stock and provided no counts or reporting");
    expect(text).toContain("no receiving count");
    expect(text).toContain("June 2026 has no count on record");
    expect(text).toContain("18 April 2026");
    expect(text).toContain("13 August 2026");
    expect(text).toContain("Their totals are not added together");
    expect(text).toContain("re-imported");
    expect(text).toContain("previous calendar month (SAST) on the 1st");
  });

  it("explains why Service Desk Reports are supporting documents only", () => {
    expect(index.serviceDeskDiscrepancies.join(" ")).toContain("No movements reported in December 2025");
    expect(index.serviceDeskDiscrepancies.join(" ")).toContain("DIS4601364122");
    expect(index.serviceDeskDiscrepancies.join(" ")).toContain("count of record");
  });

  it("points at the new Reports tabs", () => {
    expect(index.entries.map((entry) => entry.href)).toEqual([
      "?tab=history",
      "?tab=reconciliation",
      "?tab=monthly",
      "?tab=ytd",
    ]);
  });
});
