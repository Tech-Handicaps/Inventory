import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { invalidateAuditorNotes, loadAuditorNotes } from "@/lib/reports/auditor-notes";
import { AUDITOR_NOTES_KEY } from "@/lib/reports/prior-company-seed";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 40_000;

/** GET /api/reports/notes — Notes for auditors and finance. */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const notes = await loadAuditorNotes();
  return NextResponse.json(notes, { headers: { "Cache-Control": "private, no-store" } });
}

/** PUT /api/reports/notes { title, markdown, expectedVersion } — saves a new version (admins). */
export async function PUT(request: NextRequest) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    markdown?: unknown;
    expectedVersion?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const markdown = typeof body?.markdown === "string" ? body.markdown.trim() : "";
  if (!title || !markdown) {
    return NextResponse.json({ error: "Title and text are required" }, { status: 400 });
  }
  if (title.length > 200 || markdown.length > MAX_LENGTH) {
    return NextResponse.json({ error: "The notes are too long" }, { status: 400 });
  }

  const current = await prisma.reportNote.findUnique({ where: { key: AUDITOR_NOTES_KEY } });
  const currentVersion = current?.version ?? 0;
  if (typeof body?.expectedVersion === "number" && body.expectedVersion !== currentVersion) {
    return NextResponse.json(
      { error: "Someone else saved a newer version. Reload to see it before saving." },
      { status: 409 }
    );
  }
  const version = currentVersion + 1;

  const saved = await prisma.reportNote.upsert({
    where: { key: AUDITOR_NOTES_KEY },
    create: {
      key: AUDITOR_NOTES_KEY,
      title,
      markdown,
      version,
      updatedBy: auth.user.id,
      versions: { create: { version, title, markdown, savedBy: auth.user.id } },
    },
    update: {
      title,
      markdown,
      version,
      updatedBy: auth.user.id,
      versions: { create: { version, title, markdown, savedBy: auth.user.id } },
    },
  });
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.notes_updated",
    notes: `Notes for auditors and finance saved as version ${version}`,
    metadata: { key: AUDITOR_NOTES_KEY, version, previousVersion: currentVersion },
  });
  invalidateAuditorNotes();
  return NextResponse.json({
    title: saved.title,
    markdown: saved.markdown,
    version: saved.version,
    updatedAt: saved.updatedAt.toISOString(),
  });
}
