import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { listReplacementOptions } from "@/lib/finance/replacement-unit";

/** GET /api/assets/:id/replacement-options — stock units and models offered as the replacement on the write-off form */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const options = await listReplacementOptions(id);
    if (!options) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json(options);
  } catch (e) {
    return catchToJsonError(
      "GET /api/assets/[id]/replacement-options",
      e,
      "Could not load replacement options"
    );
  }
}
