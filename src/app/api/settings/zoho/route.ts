import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  loadZohoAssistSettings,
  maskZohoSecrets,
} from "@/lib/zoho/client";
import { ZOHO_DATA_CENTERS, type ZohoDataCenter } from "@/lib/zoho/constants";

const VALID_DC = new Set(ZOHO_DATA_CENTERS.map((d) => d.value));

function isValidDataCenter(v: string): v is ZohoDataCenter {
  return VALID_DC.has(v as ZohoDataCenter);
}

// GET /api/settings/zoho — masked credentials + flags (no raw secrets)
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const c = await loadZohoAssistSettings();
    const masked = maskZohoSecrets(c);
    return NextResponse.json({
      ...masked,
      readyForOAuth: !!(c.clientId && c.clientSecret),
      canTestApi:
        !!(c.clientId && c.clientSecret && c.refreshToken && c.refreshToken.length > 0),
    });
  } catch (error) {
    console.error("GET /api/settings/zoho", error);
    return NextResponse.json(
      { error: "Failed to load Zoho Assist settings" },
      { status: 500 }
    );
  }
}

// PUT /api/settings/zoho — upsert singleton row
export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const existing = await prisma.zohoAssistSettings.findUnique({
      where: { id: "singleton" },
    });

    let nextClientId = existing?.clientId ?? null;
    if (typeof body.clientId === "string") {
      nextClientId = body.clientId.trim() || null;
    }

    let nextClientSecret = existing?.clientSecret ?? null;
    if (body.clearClientSecret === true) {
      nextClientSecret = null;
    } else if (
      typeof body.clientSecret === "string" &&
      body.clientSecret.length > 0
    ) {
      nextClientSecret = body.clientSecret;
    }

    let nextRefresh = existing?.refreshToken ?? null;
    if (body.clearRefreshToken === true) {
      nextRefresh = null;
    } else if (
      typeof body.refreshToken === "string" &&
      body.refreshToken.length > 0
    ) {
      nextRefresh = body.refreshToken.trim();
    }

    let dataCenter = existing?.dataCenter ?? "us";
    if (typeof body.dataCenter === "string" && isValidDataCenter(body.dataCenter)) {
      dataCenter = body.dataCenter;
    }

    await prisma.zohoAssistSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        clientId: nextClientId,
        clientSecret: nextClientSecret,
        refreshToken: nextRefresh,
        dataCenter,
      },
      update: {
        clientId: nextClientId,
        clientSecret: nextClientSecret,
        refreshToken: nextRefresh,
        dataCenter,
      },
    });

    const c = await loadZohoAssistSettings();
    const masked = maskZohoSecrets(c);
    return NextResponse.json({
      ...masked,
      readyForOAuth: !!(c.clientId && c.clientSecret),
      canTestApi:
        !!(c.clientId && c.clientSecret && c.refreshToken && c.refreshToken.length > 0),
    });
  } catch (error) {
    console.error("PUT /api/settings/zoho", error);
    return NextResponse.json(
      { error: "Failed to save Zoho Assist settings" },
      { status: 500 }
    );
  }
}
