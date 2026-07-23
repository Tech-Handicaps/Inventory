import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { writeOffAsset } from "@/lib/finance/write-off-asset";

const writeOffSchema = z.object({
  reason: z.string().min(1, "reason is required"),
  serialNumber: z.string().nullable().optional(),
  replacementRequested: z.boolean().optional(),
  replacementNotes: z.string().optional(),
  assessmentId: z.string().trim().min(1).optional(),
});

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
    const parsed = await parseJsonBody(request, writeOffSchema);
    if (isNextResponse(parsed)) return parsed;

    const result = await writeOffAsset({
      assetId: id,
      userId: user.id,
      reason: parsed.reason,
      serialNumber: parsed.serialNumber,
      replacementRequested: parsed.replacementRequested === true,
      replacementNotes: parsed.replacementNotes,
      assessmentId: parsed.assessmentId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      asset: result.asset,
      certificateReference: result.certificateReference,
      ...(result.notifyFailed
        ? {
            warning: "Write-off saved, but finance notification failed.",
            notifyWarnings: ["write_off_notify_failed"],
          }
        : {}),
    });
  } catch (e) {
    return catchToJsonError(
      "POST /api/assets/[id]/write-off",
      e,
      "Write-off failed"
    );
  }
}
