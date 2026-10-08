import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderFinanceMonthOnMonthPdf } from "@/lib/pdf/render-finance-month-on-month";
import { buildFinanceMonthOnMonth } from "@/lib/reports/finance-month-on-month";
import { loadStoredFinancePositions } from "@/lib/reports/load-finance-month-positions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reports/finance-month-on-month/pdf?download=1
 * Current landscape of every stored official finance month.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const positions = await loadStoredFinancePositions();
    const report = buildFinanceMonthOnMonth(positions);
    const logoSource = await loadLogoForPdf();
    const generatedAt = new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
    });
    const buffer = await renderFinanceMonthOnMonthPdf({
      report,
      generatedAt,
      logoSource,
    });

    const asAttachment = request.nextUrl.searchParams.has("download");
    const filename = "hna-finance-month-on-month.pdf";
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
    console.error("GET /api/reports/finance-month-on-month/pdf", error);
    return NextResponse.json(
      { error: "Failed to generate the finance month-on-month PDF" },
      { status: 500 }
    );
  }
}
