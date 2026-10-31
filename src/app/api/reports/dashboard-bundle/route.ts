import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadDashboardBundle } from "@/lib/reports/dashboard-bundle";

export type { DashboardBundleSection } from "@/lib/reports/dashboard-bundle";

// GET /api/reports/dashboard-bundle — every Dashboard section in one round trip.
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await loadDashboardBundle(request.url, request.headers));
}
