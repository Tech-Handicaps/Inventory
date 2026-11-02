import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ensurePeriodDocumentBucket,
  isAllowedMime,
  MAX_PERIOD_DOCUMENT_BYTES,
  newStoragePath,
  PERIOD_DOCUMENT_BUCKET,
} from "@/lib/reports/period-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/reports/period-documents/upload-url { monthKey, fileName, mimeType, sizeBytes } (admins). */
export async function POST(request: NextRequest) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const monthKey = typeof body?.monthKey === "string" ? body.monthKey : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : 0;
  if (!/^\d{4}-\d{2}$/.test(monthKey) || !fileName) {
    return NextResponse.json({ error: "Month and file name are required" }, { status: 400 });
  }
  if (!isAllowedMime(mimeType)) {
    return NextResponse.json({ error: "Upload a PDF, Excel, Word or CSV file" }, { status: 400 });
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_PERIOD_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Files must be under 25 MB" }, { status: 400 });
  }

  try {
    await ensurePeriodDocumentBucket();
    const path = newStoragePath(monthKey, fileName);
    const { data, error } = await createSupabaseAdmin()
      .storage.from(PERIOD_DOCUMENT_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "No upload URL");
    return NextResponse.json({ bucket: PERIOD_DOCUMENT_BUCKET, path: data.path, token: data.token });
  } catch (error) {
    console.error("POST /api/reports/period-documents/upload-url", error);
    return NextResponse.json({ error: "Could not start the upload" }, { status: 500 });
  }
}
