import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

/** POST /api/assets/:id/unlink-assist — remove Zoho Assist association; keeps registry fields */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const { id } = await params;
    const before = await prisma.asset.findUnique({
      where: { id },
      select: {
        id: true,
        assetName: true,
        zohoAssistDeviceId: true,
        dataSource: true,
      },
    });
    if (!before) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (!before.zohoAssistDeviceId) {
      return NextResponse.json(
        { error: "This asset is not linked to Zoho Assist." },
        { status: 400 }
      );
    }

    const prevAssistId = before.zohoAssistDeviceId;
    const asset = await prisma.asset.update({
      where: { id },
      data: {
        dataSource: "manual",
        zohoAssistDeviceId: null,
        zohoAssistOrgId: null,
        zohoAssistDepartmentId: null,
      },
      include: { status: true, deviceTemplate: true, club: true },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "asset.unlinked_from_zoho_assist",
      notes: `Unlinked ${before.assetName} from Zoho Assist ${prevAssistId}`,
      metadata: {
        assetId: id,
        zohoAssistDeviceId: prevAssistId,
      },
    });

    return NextResponse.json({ asset });
  } catch (e) {
    console.error("POST /api/assets/[id]/unlink-assist", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unlink failed" },
      { status: 500 }
    );
  }
}
