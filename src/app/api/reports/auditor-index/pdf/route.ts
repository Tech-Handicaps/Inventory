import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderAuditorIndexPdf } from "@/lib/pdf/render-auditor-index";
import { buildAuditorIndex } from "@/lib/reports/auditor-index";
import { formatDateTime } from "@/lib/dates/format";
import { notesPrefaceFor } from "@/lib/reports/auditor-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/reports/auditor-index/pdf?download=1
 * The first page of the accountant file. The other reports stay behind it.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const logoSource = await loadLogoForPdf();
    const generatedAt = formatDateTime(new Date());
    const prefaceHtml = await notesPrefaceFor(["2025-10"]);
    const buffer = await renderAuditorIndexPdf({
      prefaceHtml,
      index: buildAuditorIndex(),
      generatedAt,
      logoSource,
    });

    const asAttachment = request.nextUrl.searchParams.has("download");
    const filename = "hna-auditor-index.pdf";
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
    console.error("GET /api/reports/auditor-index/pdf", error);
    return NextResponse.json(
      { error: "Failed to generate the auditor index PDF" },
      { status: 500 }
    );
  }
}
