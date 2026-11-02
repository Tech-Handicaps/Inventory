import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadDashboardActivity, loadDashboardSync } from "@/lib/reports/dashboard-tab-data";

const LOADERS = { activity: loadDashboardActivity, sync: loadDashboardSync } as const;

/** GET /api/reports/dashboard-tab?tab=activity|sync — figures for one Dashboard tab. */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const tab = request.nextUrl.searchParams.get("tab");
  if (tab !== "activity" && tab !== "sync") {
    return NextResponse.json({ error: "Unknown tab" }, { status: 400 });
  }
  try {
    return NextResponse.json(await LOADERS[tab](), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(`GET /api/reports/dashboard-tab?tab=${tab}`, error);
    return NextResponse.json({ error: "Failed to load these figures" }, { status: 500 });
  }
}
