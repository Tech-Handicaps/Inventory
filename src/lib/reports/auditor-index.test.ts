import { describe, expect, it } from "vitest";
import { buildAuditorIndex } from "@/lib/reports/auditor-index";

const index = buildAuditorIndex();
const text = [
  ...index.paragraphs,
  ...index.entries.flatMap((entry) => [entry.title, entry.covers]),
].join(" ");

describe("auditor index", () => {
  it("leads with the dates, the gap, and the rule that the series are not added", () => {
    expect(index.paragraphs[0]).toContain("Read this page first");
    expect(text).toContain("The totals are not added together");
    expect(text).toContain("18 April 2026");
    expect(text).toContain("13 August 2026");
    expect(text).toContain("labelled copies of that December take");
    expect(text).toContain("April 2026 is not a copy");
    expect(text).toContain("July, August, and September 2026 were emailed");
    expect(text).toContain("were not kept");
    expect(text).toContain("28 October 2026 prints September and skips");
    expect(text).toContain("prints October 2026");
  });

  it("names each document and leaves the other reports behind the index", () => {
    expect(index.entries.map((entry) => entry.href)).toEqual([
      "#prior-months",
      "#month-on-month",
      "#handover",
      "#finance-packs",
      "#finance-month-on-month",
      "#finance-yearly",
    ]);
    expect(text).toContain("They do not list serial numbers");
    expect(text).toContain("The live register is not on this landscape");
    expect(text).toContain("not a stored month");
    expect(text).toContain("are not added together");
    expect(text).toContain("The blocks are not subtracted");
  });
});
