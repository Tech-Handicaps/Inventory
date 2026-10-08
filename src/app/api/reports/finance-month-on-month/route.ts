import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { buildFinanceMonthOnMonth } from "@/lib/reports/finance-month-on-month";
import { loadStoredFinancePositions } from "@/lib/reports/load-finance-month-positions";

/**
 * GET /api/reports/finance-month-on-month
 * Landscape of official finance packs only. Unstored months are left out.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const positions = await loadStoredFinancePositions();
    const report = buildFinanceMonthOnMonth(positions);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/reports/finance-month-on-month", error);
    return NextResponse.json(
      { error: "Failed to load the finance month-on-month report" },
      { status: 500 }
    );
  }
}
