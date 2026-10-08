import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { buildFinanceYearly } from "@/lib/reports/finance-yearly";
import {
  loadDecember2025Workbook,
  loadStoredFinancePositions,
} from "@/lib/reports/load-finance-month-positions";

/**
 * GET /api/reports/finance-yearly
 * 2025 is the December workbook. 2026 is the latest stored finance month.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const [december2025, financePositions] = await Promise.all([
      loadDecember2025Workbook(),
      loadStoredFinancePositions(),
    ]);
    const report = buildFinanceYearly({ december2025, financePositions });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/reports/finance-yearly", error);
    return NextResponse.json(
      { error: "Failed to load the finance yearly report" },
      { status: 500 }
    );
  }
}
