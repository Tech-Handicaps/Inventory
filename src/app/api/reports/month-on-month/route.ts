import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  draftFromStoredReport,
  type LegacyMonthEndLine,
} from "@/lib/reports/legacy-month-end";
import { buildMonthOnMonthAudit } from "@/lib/reports/month-on-month-audit";

/**
 * GET /api/reports/month-on-month
 * Prior-company month-on-month landscape, October 2025 through March 2026.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const reports = await prisma.monthEndStockReport.findMany({
      orderBy: { monthKey: "asc" },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    const audit = buildMonthOnMonthAudit(
      reports.map((report) =>
        draftFromStoredReport({
          ...report,
          lines: report.lines as LegacyMonthEndLine[],
        })
      )
    );
    return NextResponse.json(audit);
  } catch (error) {
    console.error("GET /api/reports/month-on-month", error);
    return NextResponse.json(
      { error: "Failed to load the month-on-month audit" },
      { status: 500 }
    );
  }
}
