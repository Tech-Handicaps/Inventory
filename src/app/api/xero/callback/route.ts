import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";

/**
 * GET /api/xero/callback — Xero OAuth2 callback.
 * Token exchange is not implemented; return an honest error instead of a false success.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || "";

  if (error) {
    return NextResponse.redirect(
      `${base}/dashboard?xero_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${base}/dashboard?xero_error=no_code`);
  }

  console.error(
    "GET /api/xero/callback: OAuth code received but token exchange is not implemented"
  );
  return NextResponse.redirect(
    `${base}/dashboard?xero_error=${encodeURIComponent("xero_oauth_not_configured")}`
  );
}
