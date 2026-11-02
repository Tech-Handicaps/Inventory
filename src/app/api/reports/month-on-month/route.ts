import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadMonthOnMonthAudit } from "@/lib/reports/load-legacy-month-end";

/**
 * GET /api/reports/month-on-month
 * Prior-company month-on-month landscape, October 2025 through March 2026.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await loadMonthOnMonthAudit());
  } catch (error) {
    console.error("GET /api/reports/month-on-month", error);
    return NextResponse.json(
      { error: "Failed to load the month-on-month audit" },
      { status: 500 }
    );
  }
}
