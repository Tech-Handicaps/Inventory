import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  composeLegacyColumns,
  monthKeyLabel,
  summarizeLegacyLines,
  type LegacyMonthEndLine,
} from "@/lib/reports/legacy-month-end";

/**
 * GET /api/reports/legacy-month-end
 * Prior-company quantity stock takes (Oct 2025–Mar 2026). Not the live register.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const reports = await prisma.monthEndStockReport.findMany({
      orderBy: { monthKey: "asc" },
      include: { lines: true },
    });

    return NextResponse.json({
      months: reports.map((report) => {
        const totals = summarizeLegacyLines(report.lines as LegacyMonthEndLine[]);
        return {
          monthKey: report.monthKey,
          label: monthKeyLabel(report.monthKey),
          sourceKind: report.sourceKind,
          sourceFileName: report.sourceFileName,
          carriedForwardFromMonthKey: report.carriedForwardFromMonthKey,
          ...totals,
          composition: composeLegacyColumns(report.lines as LegacyMonthEndLine[]),
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/reports/legacy-month-end", error);
    return NextResponse.json(
      { error: "Failed to load prior month-end stock" },
      { status: 500 }
    );
  }
}
