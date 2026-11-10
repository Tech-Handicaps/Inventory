import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import {
  releaseReplacementReservation,
  reserveAssetForClub,
} from "@/lib/finance/replacement-reservation";

const reserveSchema = z.object({
  clubId: z.string().trim().min(1, "Choose the club this unit is going to"),
});

const releaseSchema = z.object({
  reason: z.string().trim().min(1, "Say why the reservation is being released"),
});

/** POST /api/assets/:id/reservation — reserve a New Stock / Refurbished unit for a club. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const parsed = await parseJsonBody(request, reserveSchema);
    if (isNextResponse(parsed)) return parsed;

    const result = await reserveAssetForClub({
      assetId: id,
      clubId: parsed.clubId,
      userId: auth.user.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, clubName: result.clubName });
  } catch (e) {
    return catchToJsonError("POST /api/assets/[id]/reservation", e, "Could not reserve unit");
  }
}

/** DELETE /api/assets/:id/reservation — put a reserved unit back into available stock. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const parsed = await parseJsonBody(request, releaseSchema);
    if (isNextResponse(parsed)) return parsed;

    const released = await releaseReplacementReservation({
      assetId: id,
      userId: auth.user.id,
      reason: parsed.reason,
    });
    if (!released) {
      return NextResponse.json({ error: "This unit is not reserved" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, clubName: released.clubName });
  } catch (e) {
    return catchToJsonError("DELETE /api/assets/[id]/reservation", e, "Could not release unit");
  }
}
