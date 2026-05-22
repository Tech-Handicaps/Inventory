import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { getPublicOriginFromRequest } from "@/lib/http/public-origin";
import { prisma } from "@/lib/prisma";
import { exchangeAuthorizationCode } from "@/lib/zoho/client";
import { loadZohoDeskSettings } from "@/lib/zoho/desk";

const STATE_COOKIE = "zoho_desk_oauth_state";

// GET /api/settings/zoho-desk/callback — OAuth redirect from Zoho Accounts
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const origin = getPublicOriginFromRequest(request).replace(/\/$/, "");
  const settingsUrl = new URL("/settings", origin);
  settingsUrl.searchParams.set("tab", "zoho-desk");

  const searchParams = request.nextUrl.searchParams;
  const error = searchParams.get("error");
  if (error) {
    settingsUrl.searchParams.set("zoho_desk_error", error);
    return NextResponse.redirect(settingsUrl);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    settingsUrl.searchParams.set("zoho_desk_error", "invalid_state");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const c = await loadZohoDeskSettings();
    if (!c.clientId || !c.clientSecret) {
      settingsUrl.searchParams.set("zoho_desk_error", "missing_credentials");
      return NextResponse.redirect(settingsUrl);
    }

    const redirectUri = `${origin}/api/settings/zoho-desk/callback`;

    const tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      clientId: c.clientId,
      clientSecret: c.clientSecret,
      dataCenter: c.dataCenter,
    });

    if (!tokens.refresh_token) {
      settingsUrl.searchParams.set(
        "zoho_desk_error",
        "no_refresh_token — try again with prompt=consent or paste a Self Client refresh token"
      );
      return NextResponse.redirect(settingsUrl);
    }

    await prisma.zohoDeskSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        orgId: c.orgId,
        departmentId: c.departmentId,
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        refreshToken: tokens.refresh_token,
        dataCenter: c.dataCenter,
      },
      update: {
        refreshToken: tokens.refresh_token,
      },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "integration.zoho_desk.oauth_connected",
      notes: "Zoho Desk OAuth completed; refresh token stored",
      metadata: {
        dataCenter: c.dataCenter,
        hasOrgId: !!(c.orgId && c.orgId.length > 0),
      },
    });

    settingsUrl.searchParams.set("zoho_desk", "connected");
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    console.error("GET /api/settings/zoho-desk/callback", e);
    const msg =
      e instanceof Error ? e.message.slice(0, 120) : "token_exchange_failed";
    settingsUrl.searchParams.set("zoho_desk_error", encodeURIComponent(msg));
    return NextResponse.redirect(settingsUrl);
  }
}
