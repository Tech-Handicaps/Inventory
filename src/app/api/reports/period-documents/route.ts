import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { periodInfo } from "@/lib/reports/period-catalog";
import {
  defaultFlagFor,
  isPeriodDocumentKind,
  PERIOD_DOCUMENT_BUCKET,
  safeFileName,
  sha256Hex,
} from "@/lib/reports/period-documents";
import { invalidateReconciliation } from "@/lib/reports/load-reconciliation";
import { invalidateReportPeriods, toDocumentRow } from "@/lib/reports/period-records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/reports/period-documents { monthKey, kind, title, fileName, path, notes?, documentDate? }
 * Records a file already uploaded to the signed URL: hashes it and stores the row (admins).
 */
export async function POST(request: NextRequest) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const monthKey = typeof body?.monthKey === "string" ? body.monthKey : "";
  const kind = body?.kind;
  const path = typeof body?.path === "string" ? body.path : "";
  const fileName = safeFileName(typeof body?.fileName === "string" ? body.fileName : "");
  const title = (typeof body?.title === "string" ? body.title.trim() : "") || fileName;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;
  const documentDate =
    typeof body?.documentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.documentDate)
      ? new Date(`${body.documentDate}T10:00:00.000Z`)
      : null;

  if (!/^\d{4}-\d{2}$/.test(monthKey) || !isPeriodDocumentKind(kind)) {
    return NextResponse.json({ error: "Month and document type are required" }, { status: 400 });
  }
  if (!path.startsWith(`${monthKey}/`) || path.includes("..")) {
    return NextResponse.json({ error: "Upload path does not match the month" }, { status: 400 });
  }
  let period;
  try {
    period = periodInfo(monthKey);
  } catch {
    return NextResponse.json({ error: "That month is before the first report period" }, { status: 400 });
  }
  if (kind === "reimported_pack" && period.kind !== "emailed_not_stored") {
    return NextResponse.json(
      { error: "Re-imported packs are only for July–September 2026, when packs were emailed but not stored" },
      { status: 400 }
    );
  }

  try {
    if (await prisma.periodDocument.findUnique({ where: { storagePath: path } })) {
      return NextResponse.json({ error: "This file is already recorded" }, { status: 409 });
    }
    const { data, error } = await createSupabaseAdmin().storage.from(PERIOD_DOCUMENT_BUCKET).download(path);
    if (error || !data) {
      return NextResponse.json({ error: "The uploaded file was not found" }, { status: 400 });
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const sha256 = sha256Hex(bytes);

    const doc = await prisma.periodDocument.create({
      data: {
        monthKey,
        kind,
        title: title.slice(0, 200),
        fileName,
        storagePath: path,
        mimeType: data.type || "application/octet-stream",
        sizeBytes: bytes.length,
        sha256,
        flag: defaultFlagFor(kind),
        notes,
        documentDate,
        uploadedBy: auth.user.id,
      },
    });

    let linkedEvent: string | null = null;
    if (kind === "voucher") {
      const event = await prisma.priorCompanyEvent.findFirst({
        where: { evidenceFileName: { equals: fileName, mode: "insensitive" }, evidenceDocumentId: null },
      });
      if (event) {
        await prisma.priorCompanyEvent.update({ where: { id: event.id }, data: { evidenceDocumentId: doc.id } });
        linkedEvent = event.reference;
      }
    }

    await createAuditLog({
      userId: auth.user.id,
      actionType: kind === "reimported_pack" ? "report.pack_reimported" : "report.document_uploaded",
      notes:
        kind === "reimported_pack"
          ? `Emailed finance pack for ${period.monthLabel} re-imported: ${fileName}`
          : `${title} attached to ${period.monthLabel}`,
      metadata: { documentId: doc.id, monthKey, kind, fileName, sha256, sizeBytes: bytes.length, linkedEvent },
    });
    invalidateReportPeriods();
    if (kind === "field_export") invalidateReconciliation();
    return NextResponse.json({ document: toDocumentRow(doc), linkedEvent }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reports/period-documents", error);
    return NextResponse.json({ error: "Could not record the document" }, { status: 500 });
  }
}
