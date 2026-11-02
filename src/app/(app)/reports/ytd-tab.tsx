"use client";

import { FinanceMonthOnMonthSection } from "./finance-month-on-month-section";
import { FinanceYearlySection } from "./finance-yearly-section";
import { TabIntro } from "./report-tile";

export default function YtdTab() {
  return (
    <div className="space-y-10">
      <TabIntro title="Year to date">
        Stored finance months compared and the yearly sheet; hardware and USB readers add to the totals, other items sit outside them.
      </TabIntro>
      <FinanceMonthOnMonthSection />
      <FinanceYearlySection />
    </div>
  );
}
