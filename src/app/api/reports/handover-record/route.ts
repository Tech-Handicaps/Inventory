import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { HANDOVER_SEED } from "@/lib/reports/prior-company-seed";
import { invalidateReportPeriods } from "@/lib/reports/period-records";

export const dynamic = "force-dynamic";

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** PATCH /api/reports/handover-record { receivedOn?, receivedBy?, reference?, notes? } (admins). */
export async function PATCH(request: NextRequest) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  const receivedOnRaw = typeof body.receivedOn === "string" ? body.receivedOn : "";
  if (receivedOnRaw && !/^2026-05-\d{2}$/.test(receivedOnRaw)) {
    return NextResponse.json({ error: "The hand-over date must be in May 2026" }, { status: 400 });
  }
  const data = {
    receivedOn: receivedOnRaw ? new Date(`${receivedOnRaw}T10:00:00.000Z`) : null,
    receivedBy: text(body.receivedBy, 200),
    reference: text(body.reference, 200),
    notes: text(body.notes, 4000),
    updatedBy: auth.user.id,
  };

  const before = await prisma.handoverRecord.findUnique({ where: { monthKey: HANDOVER_SEED.monthKey } });
  const saved = await prisma.handoverRecord.upsert({
    where: { monthKey: HANDOVER_SEED.monthKey },
    create: { ...HANDOVER_SEED, ...data },
    update: data,
  });
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.handover_updated",
    notes: "May 2026 hand-over record updated",
    metadata: {
      before: before
        ? { receivedOn: before.receivedOn, receivedBy: before.receivedBy, reference: before.reference, notes: before.notes }
        : null,
      after: { receivedOn: saved.receivedOn, receivedBy: saved.receivedBy, reference: saved.reference, notes: saved.notes },
    },
  });
  invalidateReportPeriods();
  return NextResponse.json({ ok: true });
}
