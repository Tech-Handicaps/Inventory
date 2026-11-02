import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { invalidateReportPeriods } from "@/lib/reports/period-records";

export const dynamic = "force-dynamic";

/** PATCH /api/reports/inconsistencies/:id { status: "open" | "resolved", resolution? } (admins). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status;
  const resolution = typeof body?.resolution === "string" ? body.resolution.trim().slice(0, 2000) : "";
  if (status !== "open" && status !== "resolved") {
    return NextResponse.json({ error: "Status must be open or resolved" }, { status: 400 });
  }
  if (status === "resolved" && !resolution) {
    return NextResponse.json({ error: "Say how it was resolved" }, { status: 400 });
  }

  const flag = await prisma.dataInconsistency.findUnique({ where: { id } });
  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.dataInconsistency.update({
    where: { id },
    data:
      status === "resolved"
        ? { status, resolution, resolvedBy: auth.user.id, resolvedAt: new Date() }
        : { status, resolution: null, resolvedBy: null, resolvedAt: null },
  });
  await createAuditLog({
    userId: auth.user.id,
    actionType: status === "resolved" ? "report.inconsistency_resolved" : "report.inconsistency_reopened",
    notes: `${flag.title}${status === "resolved" ? ` – resolved: ${resolution}` : " – reopened"}`,
    metadata: { key: flag.key, previousStatus: flag.status },
  });
  invalidateReportPeriods();
  return NextResponse.json({ ok: true });
}
