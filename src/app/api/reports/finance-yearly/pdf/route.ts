import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderFinanceYearlyPdf } from "@/lib/pdf/render-finance-yearly";
import { buildFinanceYearly } from "@/lib/reports/finance-yearly";
import {
  loadDecember2025Workbook,
  loadStoredFinancePositions,
} from "@/lib/reports/load-finance-month-positions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reports/finance-yearly/pdf?download=1
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
    const logoSource = await loadLogoForPdf();
    const generatedAt = new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
    });
    const buffer = await renderFinanceYearlyPdf({
      report,
      generatedAt,
      logoSource,
    });
    const asAttachment = request.nextUrl.searchParams.has("download");
    const filename = "hna-finance-yearly.pdf";
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
    console.error("GET /api/reports/finance-yearly/pdf", error);
    return NextResponse.json(
      { error: "Failed to generate the finance yearly PDF" },
      { status: 500 }
    );
  }
}
