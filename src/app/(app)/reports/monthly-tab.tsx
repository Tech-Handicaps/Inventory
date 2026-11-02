"use client";

import { useAppRole } from "@/components/RoleProvider";
import { FinancePacksSection } from "./finance-packs-section";
import { ReportTile, TabIntro, type ReportDef } from "./report-tile";

const LIVE: ReportDef[] = [
  {
    id: "reconcile",
    type: "reconcile",
    title: "Stock reconcile as at today",
    description:
      "New stock, refurbished and total stock by asset type, from the register as it is right now. Not a month-end pack.",
    audience: "Finance · Accounting",
  },
  {
    id: "breakdown",
    type: "stock_breakdown",
    title: "Stock breakdown by make and model (today)",
    description: "New, refurbished and written-off units itemised by make and model, as of now.",
    audience: "Finance · Accounting",
  },
];

export default function MonthlyTab() {
  const { role } = useAppRole();
  return (
    <div className="space-y-8">
      <TabIntro title="Monthly pack">
        The official pack for each closed month, exactly as it was stored and emailed to finance.
      </TabIntro>
      {role !== "operations" ? <FinancePacksSection /> : null}
      <section className="space-y-4">
        <h3 className="font-heading text-base font-bold text-ink">This month so far</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {LIVE.map((report) => (
            <ReportTile key={report.id} report={report} />
          ))}
        </div>
      </section>
    </div>
  );
}
