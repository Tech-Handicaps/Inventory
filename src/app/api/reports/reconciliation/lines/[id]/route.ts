import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { invalidateReconciliation } from "@/lib/reports/load-reconciliation";
import { parseReconLineInput } from "@/lib/reports/recon-line-input";

export const dynamic = "force-dynamic";

function snapshot(line: { section: string; label: string; quantity: number; status: string; notes: string | null }) {
  return { section: line.section, label: line.label, quantity: line.quantity, status: line.status, notes: line.notes };
}

/** PATCH /api/reports/reconciliation/lines/:id (admins). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = parseReconLineInput(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const before = await prisma.reconciliationLine.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Line not found" }, { status: 404 });
  const after = await prisma.reconciliationLine.update({
    where: { id },
    data: { ...parsed.data, updatedBy: auth.user.id },
  });
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.reconciliation_line_updated",
    notes: `Reconciliation line updated: ${after.label}`,
    metadata: { lineId: id, before: snapshot(before), after: snapshot(after) },
  });
  invalidateReconciliation();
  return NextResponse.json({ ok: true });
}

/** DELETE /api/reports/reconciliation/lines/:id (admins). The removed line is kept in the audit log. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const before = await prisma.reconciliationLine.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Line not found" }, { status: 404 });
  await prisma.reconciliationLine.delete({ where: { id } });
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.reconciliation_line_removed",
    notes: `Reconciliation line removed: ${before.label} (${before.quantity})`,
    metadata: { lineId: id, before: snapshot(before) },
  });
  invalidateReconciliation();
  return NextResponse.json({ ok: true });
}
