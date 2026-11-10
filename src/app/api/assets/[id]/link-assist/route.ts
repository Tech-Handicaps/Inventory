import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { deployReservedReplacement } from "@/lib/finance/replacement-reservation";
import { prisma } from "@/lib/prisma";
import { isDepotStockStatus } from "@/lib/zoho/assist-lifecycle";
import { linkAssistToAsset } from "@/lib/zoho/link-assist-to-asset";

export const runtime = "nodejs";

const linkAssistSchema = z.object({
  resourceId: z.string().trim().min(1, "resourceId is required"),
  displayName: z.string().optional(),
});

/** POST /api/assets/:id/link-assist — associate an existing asset with a Zoho Assist device */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const { id } = await params;
    const parsed = await parseJsonBody(request, linkAssistSchema);
    if (isNextResponse(parsed)) return parsed;

    const result = await linkAssistToAsset({
      assetId: id,
      resourceId: parsed.resourceId,
      displayName: parsed.displayName,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
          ...(result.assetId ? { assetId: result.assetId } : {}),
        },
        { status: result.status }
      );
    }

    await createAuditLog({
      userId: user.id,
      actionType: "asset.linked_to_zoho_assist",
      notes: `Linked ${result.asset.assetName} to Zoho Assist ${result.assistDeviceId}`,
      metadata: {
        assetId: id,
        zohoAssistDeviceId: result.assistDeviceId,
        assistDisplayName: result.assistDisplayName,
        serialMismatchWarning: result.serialMismatchWarning,
      },
    });

    const replacementDeployed = isDepotStockStatus(result.asset.status.code)
      ? await deployReservedReplacement({
          assetId: id,
          fromStatusCode: result.asset.status.code,
          userId: user.id,
          via: "assist_link",
          setDeployedStatus: true,
        })
      : null;
    const asset = replacementDeployed
      ? await prisma.asset.findUniqueOrThrow({
          where: { id },
          include: { status: true, deviceTemplate: true, club: true },
        })
      : result.asset;

    return NextResponse.json({
      asset,
      replacementDeployed,
      assistDeviceId: result.assistDeviceId,
      assistDisplayName: result.assistDisplayName,
      serialMismatchWarning: result.serialMismatchWarning,
    });
  } catch (e) {
    return catchToJsonError(
      "POST /api/assets/[id]/link-assist",
      e,
      "Link failed"
    );
  }
}
