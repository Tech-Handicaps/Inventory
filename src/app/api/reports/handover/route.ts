import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { buildStockHandover } from "@/lib/reports/stock-handover";

/**
 * GET /api/reports/handover
 * Dates joining the prior-company stock takes and this system's register.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(buildStockHandover(), {
    headers: { "Cache-Control": "no-store" },
  });
}
