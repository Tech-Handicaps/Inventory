import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadPeriodsOverview } from "@/lib/reports/period-records";

export const dynamic = "force-dynamic";

/** GET /api/reports/periods — every report period with its label, files, events and pack. */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const overview = await loadPeriodsOverview();
    return NextResponse.json(overview, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/reports/periods", error);
    return NextResponse.json({ error: "Failed to load report periods" }, { status: 500 });
  }
}
