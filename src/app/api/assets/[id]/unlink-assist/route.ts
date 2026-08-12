import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { detachAssistFromAsset } from "@/lib/zoho/assist-lifecycle";
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
        status: { select: { code: true } },
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

    const asset = await detachAssistFromAsset(id, {
      userId: user.id,
      reason: "manual_unlink",
      resetAssistDisplayName: true,
    });

    return NextResponse.json({ asset });
  } catch (e) {
    const { catchToJsonError } = await import("@/lib/api/error-response");
    return catchToJsonError(
      "POST /api/assets/[id]/unlink-assist",
      e,
      "Unlink failed"
    );
  }
}
