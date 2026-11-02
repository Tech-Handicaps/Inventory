import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { invalidateInventoryStats } from "@/lib/cache/inventory-stats";
import { prisma } from "@/lib/prisma";
import { invalidateModelAliases } from "@/lib/inventory/model-aliases";
import { parseAliasInput } from "@/lib/inventory/model-alias-input";

export const dynamic = "force-dynamic";

function snapshot(row: { kind: string; alias: string; canonical: string; notes: string | null }) {
  return { kind: row.kind, alias: row.alias, canonical: row.canonical, notes: row.notes };
}

/** PATCH /api/reports/model-aliases/:id (admins). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = parseAliasInput(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const before = await prisma.modelAlias.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  const after = await prisma.modelAlias.update({ where: { id }, data: parsed.data });
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.model_alias_updated",
    notes: `Alias updated: ${after.alias} → ${after.canonical}`,
    metadata: { aliasId: id, before: snapshot(before), after: snapshot(after) },
  });
  invalidateModelAliases();
  invalidateInventoryStats();
  return NextResponse.json({ ok: true });
}

/** DELETE /api/reports/model-aliases/:id (admins). The removed alias is kept in the audit log. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const before = await prisma.modelAlias.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  await prisma.modelAlias.delete({ where: { id } });
  await createAuditLog({
    userId: auth.user.id,
    actionType: "report.model_alias_removed",
    notes: `Alias removed: ${before.alias} → ${before.canonical}`,
    metadata: { aliasId: id, before: snapshot(before) },
  });
  invalidateModelAliases();
  invalidateInventoryStats();
  return NextResponse.json({ ok: true });
}
