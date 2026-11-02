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
        Every month from October 2025 with what is actually on record for it, the source files and their hashes, and the
        prior-company movements.
      </TabIntro>
      <PeriodsSection />
      <MonthOnMonthSection />
      <LegacyMonthEndSection />
      <HandoverSection />
    </div>
  );
}
