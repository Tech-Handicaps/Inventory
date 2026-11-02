import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { invalidateReconciliation } from "@/lib/reports/load-reconciliation";
import { parseReconLineInput } from "@/lib/reports/recon-line-input";

export const dynamic = "force-dynamic";

/** POST /api/reports/reconciliation/lines { section, label, quantity, status, notes? } (admins). */
export async function POST(request: NextRequest) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = parseReconLineInput(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const last = await prisma.reconciliationLine.findFirst({ orderBy: { sortOrder: "desc" } });
  const line = await prisma.reconciliationLine.create({
    data: { ...parsed.data, sortOrder: (last?.sortOrder ?? -1) + 1, updatedBy: auth.user.id },
  });
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.reconciliation_line_added",
    notes: `Reconciliation line added: ${line.label} (${line.quantity})`,
    metadata: { lineId: line.id, after: parsed.data },
  });
  invalidateReconciliation();
  return NextResponse.json({ id: line.id }, { status: 201 });
}
