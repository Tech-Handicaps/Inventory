import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderLegacyMonthEndPdf } from "@/lib/pdf/render-legacy-month-end-report";
import { prisma } from "@/lib/prisma";
import {
  draftFromStoredReport,
  type LegacyMonthEndLine,
} from "@/lib/reports/legacy-month-end";
import { formatDateTime } from "@/lib/dates/format";
import { notesPrefaceFor } from "@/lib/reports/auditor-notes";
import { toEventRow } from "@/lib/reports/period-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MONTH_KEY = /^\d{4}-\d{2}$/;

/**
 * GET /api/reports/legacy-month-end/pdf?month=2025-10&download=1
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  const month = request.nextUrl.searchParams.get("month")?.trim() ?? "";
  if (!MONTH_KEY.test(month)) {
    return NextResponse.json(
      { error: "Query month is required as YYYY-MM" },
      { status: 400 }
    );
  }

  try {
    const report = await prisma.monthEndStockReport.findUnique({
      where: { monthKey: month },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!report) {
      return NextResponse.json(
        { error: "No prior-company stock take for that month" },
        { status: 404 }
      );
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const [logoSource, prefaceHtml, events, documents] = await Promise.all([
      loadLogoForPdf(),
      notesPrefaceFor([month]),
      prisma.priorCompanyEvent.findMany({
        where: {
          eventDate: {
            gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
            lt: new Date(Date.UTC(year, monthNumber, 1)),
          },
        },
        orderBy: [{ eventDate: "asc" }, { reference: "asc" }],
      }),
      prisma.periodDocument.findMany({
        where: { monthKey: month },
        orderBy: { uploadedAt: "asc" },
        select: { title: true, fileName: true, sha256: true, flag: true },
      }),
    ]);
    const generatedAt = formatDateTime(new Date());
    const buffer = await renderLegacyMonthEndPdf({
      prefaceHtml,
      events: events.map(toEventRow),
      documents,
      draft: draftFromStoredReport({
        ...report,
        lines: report.lines as LegacyMonthEndLine[],
      }),
      generatedAt,
      logoSource,
    });

    const asAttachment = request.nextUrl.searchParams.has("download");
    const filename = `hna-prior-month-end-stock-${month}.pdf`;
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
    console.error("GET /api/reports/legacy-month-end/pdf", error);
    return NextResponse.json(
      { error: "Failed to generate prior month-end stock PDF" },
      { status: 500 }
    );
  }
}
