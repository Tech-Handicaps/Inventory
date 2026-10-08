import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderStockHandoverPdf } from "@/lib/pdf/render-stock-handover";
import { buildStockHandover } from "@/lib/reports/stock-handover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reports/handover/pdf?download=1
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const logoSource = await loadLogoForPdf();
    const generatedAt = new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
    });
    const buffer = await renderStockHandoverPdf({
      handover: buildStockHandover(),
      generatedAt,
      logoSource,
    });

    const asAttachment = request.nextUrl.searchParams.has("download");
    const filename = "hna-stock-handover.pdf";
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
    console.error("GET /api/reports/handover/pdf", error);
    return NextResponse.json(
      { error: "Failed to generate the stock handover PDF" },
      { status: 500 }
    );
  }
}
