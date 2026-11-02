import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { formatDateTime } from "@/lib/dates/format";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderReconciliationPdf } from "@/lib/pdf/render-reconciliation";
import { prisma } from "@/lib/prisma";
import { notesPrefaceFor } from "@/lib/reports/auditor-notes";
import { loadReconciliation } from "@/lib/reports/load-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/reports/reconciliation/pdf[?download=1] */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const [report, logoSource, prefaceHtml, handover] = await Promise.all([
      loadReconciliation(),
      loadLogoForPdf(),
      notesPrefaceFor(["2026-01"]),
      prisma.handoverRecord.findUnique({ where: { monthKey: "2026-05" }, select: { basis: true } }),
    ]);
    const buffer = await renderReconciliationPdf({
      prefaceHtml,
      report,
      handoverBasis: handover?.basis ?? null,
      generatedAt: formatDateTime(new Date()),
      logoSource,
    });
    const filename = "hna-reconciliation-prior-count-to-register.pdf";
    const disposition = request.nextUrl.searchParams.has("download")
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": disposition, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/reports/reconciliation/pdf", error);
    return NextResponse.json({ error: "Failed to generate the reconciliation PDF" }, { status: 500 });
  }
}
