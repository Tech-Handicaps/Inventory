import { NextResponse } from "next/server";
import { loadDashboardOverview } from "@/lib/reports/dashboard-overview";
import { loadDashboardActivity, loadDashboardSync } from "@/lib/reports/dashboard-tab-data";
import { loadPeriodsOverview } from "@/lib/reports/period-records";
import { loadReconciliation } from "@/lib/reports/load-reconciliation";
import { loadAuditorNotes } from "@/lib/reports/auditor-notes";
import { loadLegacyMonthEndList, loadMonthOnMonthAudit } from "@/lib/reports/load-legacy-month-end";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/warm — keeps the server and the dashboard / reports caches warm.
 * Public (pinged every 5 minutes by GitHub Actions), so it returns timings only, never data.
 */
export async function GET() {
  const started = Date.now();
  const results = await Promise.allSettled([
    loadDashboardOverview(),
    loadDashboardActivity(),
    loadDashboardSync(),
    loadPeriodsOverview(),
    loadReconciliation(),
    loadAuditorNotes(),
    loadLegacyMonthEndList(),
    loadMonthOnMonthAudit(),
  ]);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    results.forEach((r) => {
      if (r.status === "rejected") console.error("GET /api/warm", r.reason);
    });
  }
  return NextResponse.json(
    { ok: failed === 0, failed, ms: Date.now() - started },
    { status: failed === 0 ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
