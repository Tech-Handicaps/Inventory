import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { writeOffAsset } from "@/lib/finance/write-off-asset";

/** POST /api/assets/:id/write-off — structured write-off from Assessment/Maintenance or In Repairs */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const reason = typeof body.reason === "string" ? body.reason : "";
    const serialNumber =
      body.serialNumber === null || typeof body.serialNumber === "string"
        ? body.serialNumber
        : undefined;
    const replacementRequested = body.replacementRequested === true;
    const replacementNotes =
      typeof body.replacementNotes === "string" ? body.replacementNotes : undefined;
    const assessmentId =
      typeof body.assessmentId === "string" ? body.assessmentId : undefined;

    const result = await writeOffAsset({
      assetId: id,
      userId: user.id,
      reason,
      serialNumber,
      replacementRequested,
      replacementNotes,
      assessmentId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ asset: result.asset });
  } catch (e) {
    console.error("POST /api/assets/[id]/write-off", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Write-off failed" },
      { status: 500 }
    );
  }
}
