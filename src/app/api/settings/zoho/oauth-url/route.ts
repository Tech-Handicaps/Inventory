import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  getAccountsBaseUrl,
  loadZohoAssistSettings,
  ZOHO_ASSIST_OAUTH_SCOPES,
} from "@/lib/zoho/client";

const STATE_COOKIE = "zoho_oauth_state";
const STATE_MAX_AGE = 600;

// GET /api/settings/zoho/oauth-url — returns authorize URL + sets CSRF cookie
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const c = await loadZohoAssistSettings();
    if (!c.clientId || !c.clientSecret) {
      return NextResponse.json(
        { error: "Save Client ID and Client Secret first." },
        { status: 400 }
      );
    }

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const redirectUri = `${base.replace(/\/$/, "")}/api/settings/zoho/callback`;

    const state = randomBytes(24).toString("hex");
    const accounts = getAccountsBaseUrl(c.dataCenter);

    const params = new URLSearchParams({
      scope: ZOHO_ASSIST_OAUTH_SCOPES,
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
    console.error("GET /api/settings/zoho/oauth-url", error);
    return NextResponse.json(
      { error: "Failed to build OAuth URL" },
      { status: 500 }
    );
  }
}
