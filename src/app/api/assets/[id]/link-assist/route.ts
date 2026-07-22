import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { linkAssistToAsset } from "@/lib/zoho/link-assist-to-asset";

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
    const body = (await request.json()) as {
      resourceId?: string;
      displayName?: string;
    };

    const result = await linkAssistToAsset({
      assetId: id,
      resourceId: body.resourceId,
      displayName: body.displayName,
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

    return NextResponse.json({
      asset: result.asset,
      assistDeviceId: result.assistDeviceId,
      assistDisplayName: result.assistDisplayName,
      serialMismatchWarning: result.serialMismatchWarning,
    });
  } catch (e) {
    console.error("POST /api/assets/[id]/link-assist", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Link failed" },
      { status: 500 }
    );
  }
}
