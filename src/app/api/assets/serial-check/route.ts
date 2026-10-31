import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { findAssetBySerial } from "@/lib/inventory/serial-lookup";

// GET /api/assets/serial-check?serial=ABC123[&excludeId=...] - is this serial already registered?
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const params = request.nextUrl.searchParams;
    const serial = (params.get("serial") ?? "").slice(0, 200);
    const excludeId = params.get("excludeId") ?? undefined;
    const match = await findAssetBySerial(serial, excludeId);
    return NextResponse.json({ exists: match !== null, asset: match });
  } catch (error) {
    return catchToJsonError("GET /api/assets/serial-check", error, "Serial check failed");
  }
}
