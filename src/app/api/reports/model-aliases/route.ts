import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { invalidateInventoryStats } from "@/lib/cache/inventory-stats";
import { prisma } from "@/lib/prisma";
import { invalidateModelAliases } from "@/lib/inventory/model-aliases";
import { parseAliasInput } from "@/lib/inventory/model-alias-input";

export const dynamic = "force-dynamic";

/** GET /api/reports/model-aliases */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rows = await prisma.modelAlias.findMany({ orderBy: [{ kind: "asc" }, { alias: "asc" }] });
  return NextResponse.json(
    rows.map((row) => ({ id: row.id, kind: row.kind, alias: row.alias, canonical: row.canonical, notes: row.notes, updatedAt: row.updatedAt.toISOString() })),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/** POST /api/reports/model-aliases { kind, alias, canonical, notes? } (admins). */
export async function POST(request: NextRequest) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const parsed = parseAliasInput(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const row = await prisma.modelAlias.create({ data: { ...parsed.data, createdBy: auth.user.id } });
    await createAuditLog({
      userId: auth.user.id,
      actionType: "report.model_alias_added",
      notes: `Alias added: ${row.alias} → ${row.canonical} (${row.kind})`,
      metadata: { aliasId: row.id, after: parsed.data },
    });
    invalidateModelAliases();
    invalidateInventoryStats();
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That spelling already has an alias" }, { status: 409 });
    }
    throw error;
  }
}
