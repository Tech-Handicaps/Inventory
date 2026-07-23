import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError, jsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { prisma } from "@/lib/prisma";

const patchAssessmentSchema = z.object({
  action: z.literal("cancel"),
});

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
    const parsed = await parseJsonBody(request, patchAssessmentSchema);
    if (isNextResponse(parsed)) return parsed;

    const row = await prisma.assessment.findUnique({
      where: { id },
      include: { asset: { include: { status: true } } },
    });

    if (!row) {
      return jsonError("Assessment/Maintenance intake not found", 404);
    }

    if (row.workflowStatus !== "open") {
      return jsonError("Only open intakes can be cancelled.", 400);
    }

    const deployed = await prisma.assetStatus.findFirst({
      where: { code: "deployed" },
    });
    if (!deployed) {
      return jsonError("Deployed status missing", 500);
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
    return catchToJsonError(
      "PATCH /api/assessments/[id]",
      e,
      "Failed to update assessment"
    );
  }
}
