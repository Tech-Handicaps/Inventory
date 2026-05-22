import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { getPublicOriginFromRequest } from "@/lib/http/public-origin";
import { getAccountsBaseUrl } from "@/lib/zoho/client";
import { loadZohoDeskSettings, ZOHO_DESK_OAUTH_SCOPES } from "@/lib/zoho/desk";

const STATE_COOKIE = "zoho_desk_oauth_state";
const STATE_MAX_AGE = 600;

// GET /api/settings/zoho-desk/oauth-url — authorize URL + CSRF cookie (Desk scopes)
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const c = await loadZohoDeskSettings();
    if (!c.clientId || !c.clientSecret) {
      return NextResponse.json(
        { error: "Save Client ID and Client Secret first." },
        { status: 400 }
      );
    }

    const origin = getPublicOriginFromRequest(request).replace(/\/$/, "");
    const redirectUri = `${origin}/api/settings/zoho-desk/callback`;

    const state = randomBytes(24).toString("hex");
    const accounts = getAccountsBaseUrl(c.dataCenter);

    const params = new URLSearchParams({
      scope: ZOHO_DESK_OAUTH_SCOPES,
      client_id: c.clientId,
      response_type: "code",
      access_type: "offline",
      redirect_uri: redirectUri,
      prompt: "consent",
      state,
    });

    const url = `${accounts}/oauth/v2/auth?${params.toString()}`;

    const res = NextResponse.json({ url, redirectUri });
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_MAX_AGE,
    });
    return res;
  } catch (error) {
    console.error("GET /api/settings/zoho-desk/oauth-url", error);
    return NextResponse.json(
      { error: "Failed to build OAuth URL" },
      { status: 500 }
    );
  }
}
