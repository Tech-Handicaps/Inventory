import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  ensureWriteOffCertificateForAsset,
  renderWriteOffCertificatePdfForRecord,
} from "@/lib/finance/write-off-certificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/assets/:id/write-off-certificate — download Chromium-printed write-off PDF */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const cert = await ensureWriteOffCertificateForAsset(id);
    if (!cert) {
      return NextResponse.json(
        { error: "No write-off certificate for this asset (must be Written off)." },
        { status: 404 }
      );
    }

    const buffer = await renderWriteOffCertificatePdfForRecord(cert);
    const safe = `${cert.referenceNumber}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safe}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET /api/assets/[id]/write-off-certificate", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not generate certificate PDF" },
      { status: 500 }
    );
  }
}
