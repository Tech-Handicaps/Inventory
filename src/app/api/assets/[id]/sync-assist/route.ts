import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { syncPublicIpForOneAsset } from "@/lib/zoho/sync-public-ip";

/** POST /api/assets/:id/sync-assist — refresh public IP + geo from Zoho Assist for this asset */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const result = await syncPublicIpForOneAsset(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Sync failed" },
      { status: result.error === "Asset not found" ? 404 : 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
