import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { exchangeAuthorizationCode, loadZohoAssistSettings } from "@/lib/zoho/client";

const STATE_COOKIE = "zoho_oauth_state";

// GET /api/settings/zoho/callback — OAuth redirect from Zoho Accounts
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const settingsUrl = new URL("/settings", base);
  settingsUrl.searchParams.set("tab", "zoho");

  const searchParams = request.nextUrl.searchParams;
  const error = searchParams.get("error");
  if (error) {
    settingsUrl.searchParams.set("zoho_error", error);
    return NextResponse.redirect(settingsUrl);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    settingsUrl.searchParams.set(
      "zoho_error",
      "invalid_state"
    );
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const c = await loadZohoAssistSettings();
    if (!c.clientId || !c.clientSecret) {
      settingsUrl.searchParams.set("zoho_error", "missing_credentials");
      return NextResponse.redirect(settingsUrl);
    }

    const redirectUri = `${base.replace(/\/$/, "")}/api/settings/zoho/callback`;

    const tokens = await exchangeAuthorizationCode({
      code,
      redirectUri,
      clientId: c.clientId,
      clientSecret: c.clientSecret,
      dataCenter: c.dataCenter,
    });

    if (!tokens.refresh_token) {
      settingsUrl.searchParams.set(
        "zoho_error",
        "no_refresh_token — try again with prompt=consent or paste a Self Client refresh token"
      );
      return NextResponse.redirect(settingsUrl);
    }

    await prisma.zohoAssistSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        refreshToken: tokens.refresh_token ?? null,
        dataCenter: c.dataCenter,
      },
      update: {
        refreshToken: tokens.refresh_token,
      },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "integration.zoho.oauth_connected",
      notes: "Zoho Assist OAuth completed; refresh token stored",
      metadata: { dataCenter: c.dataCenter },
    });

    settingsUrl.searchParams.set("zoho", "connected");
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    console.error("GET /api/settings/zoho/callback", e);
    const msg =
      e instanceof Error ? e.message.slice(0, 120) : "token_exchange_failed";
    settingsUrl.searchParams.set("zoho_error", encodeURIComponent(msg));
    return NextResponse.redirect(settingsUrl);
  }
}
