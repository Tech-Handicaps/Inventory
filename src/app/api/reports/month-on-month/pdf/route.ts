import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderMonthOnMonthAuditPdf } from "@/lib/pdf/render-month-on-month-audit";
import { prisma } from "@/lib/prisma";
import {
  draftFromStoredReport,
  type LegacyMonthEndLine,
} from "@/lib/reports/legacy-month-end";
import { buildMonthOnMonthAudit } from "@/lib/reports/month-on-month-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reports/month-on-month/pdf?download=1
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
    const logoSource = await loadLogoForPdf();
    const generatedAt = new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
    });
    const buffer = await renderMonthOnMonthAuditPdf({
      audit,
      generatedAt,
      logoSource,
    });

    const asAttachment = request.nextUrl.searchParams.has("download");
    const filename = "hna-prior-company-month-on-month.pdf";
    const disposition = asAttachment
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/reports/month-on-month/pdf", error);
    return NextResponse.json(
      { error: "Failed to generate the month-on-month audit PDF" },
      { status: 500 }
    );
  }
}
