import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { syncAllAssistAssetsPublicIp } from "@/lib/zoho/sync-public-ip";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = request.nextUrl.searchParams.get("secret");
  return q === secret;
}

/**
 * Weekly job: refresh public IP + GeoIP for all Assist-linked assets.
 * Vercel Cron: GET with Authorization: Bearer CRON_SECRET (or ?secret= for local testing).
 * Manual: POST while signed in as admin.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncAllAssistAssetsPublicIp();
    return NextResponse.json(result);
  } catch (e) {
    console.error("cron sync-assist-public-ip", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "super_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await syncAllAssistAssetsPublicIp();
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST sync-assist-public-ip", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
