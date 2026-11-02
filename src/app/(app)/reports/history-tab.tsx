"use client";

import { HandoverSection } from "./handover-section";
import { LegacyMonthEndSection } from "./legacy-month-end-section";
import { MonthOnMonthSection } from "./month-on-month-section";
import { PeriodsSection } from "./periods-section";
import { TabIntro } from "./report-tile";

export default function HistoryTab() {
  return (
    <div className="space-y-10">
      <TabIntro title="History (before this system)">
        Every month from October 2025 with what is actually on record for it, the source files{" "}
        <span
          className="underline decoration-dotted underline-offset-2"
          title="Each file is stored with its SHA-256 hash, so any later change to the file would show."
        >
          kept exactly as uploaded
        </span>
        , and the prior-company movements.
      </TabIntro>
      <PeriodsSection />
      <MonthOnMonthSection />
      <LegacyMonthEndSection />
      <HandoverSection />
    </div>
  );
}
