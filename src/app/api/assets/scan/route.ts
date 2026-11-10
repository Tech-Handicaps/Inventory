import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { lookupScannedCode, unitsWithoutSerial } from "@/lib/inventory/scan-lookup";

/**
 * GET /api/assets/scan?code=… — resolve a scanned barcode / QR code.
 * Not found responses include units with no real serial, for "attach to an existing unit".
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const code = request.nextUrl.searchParams.get("code") ?? "";
    const result = await lookupScannedCode(code);
    if (!result) {
      return NextResponse.json({ error: "Scan or type a serial number" }, { status: 400 });
    }
    if (result.asset) return NextResponse.json(result);
    return NextResponse.json({ ...result, unitsWithoutSerial: await unitsWithoutSerial() });
  } catch (e) {
    return catchToJsonError("GET /api/assets/scan", e, "Lookup failed");
  }
}
