import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

/** PATCH /api/assessments/:id — cancel open assessment → return asset to Deployed */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const action =
      typeof body.action === "string" ? body.action.trim() : "";

    const row = await prisma.assessment.findUnique({
      where: { id },
      include: { asset: { include: { status: true } } },
    });

    if (!row) {
      return NextResponse.json({ error: "Assessment/Maintenance intake not found" }, { status: 404 });
    }

    if (action !== "cancel") {
      return NextResponse.json(
        { error: 'Unsupported action (use {"action":"cancel"}).' },
        { status: 400 }
      );
    }

    if (row.workflowStatus !== "open") {
      return NextResponse.json(
        { error: "Only open intakes can be cancelled." },
        { status: 400 }
      );
    }

    const deployed = await prisma.assetStatus.findFirst({
      where: { code: "deployed" },
    });
    if (!deployed) {
      return NextResponse.json({ error: "Deployed status missing" }, { status: 500 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.assessment.update({
        where: { id },
        data: {
          workflowStatus: "cancelled",
          cancelledAt: new Date(),
        },
      });
      if (row.asset.status.code === "assessment") {
        await tx.asset.update({
          where: { id: row.assetId },
          data: { statusId: deployed.id },
        });
      }
    });

    await createAuditLog({
      userId: user.id,
      actionType: "assessment.cancelled",
      notes: `Assessment/Maintenance intake ${row.referenceNumber} cancelled — ${row.asset.assetName}`,
      metadata: { assessmentId: id, assetId: row.assetId },
    });

    const updated = await prisma.assessment.findUnique({
      where: { id },
      include: { asset: { include: { status: true } } },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/assessments/[id]", e);
    return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 });
  }
}
