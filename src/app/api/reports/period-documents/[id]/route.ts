import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { PERIOD_DOCUMENT_BUCKET } from "@/lib/reports/period-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports/period-documents/:id[?download=1] — the stored file, unchanged. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const doc = await prisma.periodDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data, error } = await createSupabaseAdmin().storage.from(PERIOD_DOCUMENT_BUCKET).download(doc.storagePath);
  if (error || !data) {
    console.error("GET /api/reports/period-documents/:id", error);
    return NextResponse.json({ error: "The stored file could not be opened" }, { status: 500 });
  }
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.document_downloaded",
    notes: `${doc.title} (${doc.monthKey}) opened`,
    metadata: { documentId: doc.id, monthKey: doc.monthKey, kind: doc.kind },
  });

  const asAttachment = request.nextUrl.searchParams.has("download") || doc.mimeType !== "application/pdf";
  const encoded = encodeURIComponent(doc.fileName);
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
      "X-Content-SHA256": doc.sha256,
    },
  });
}
