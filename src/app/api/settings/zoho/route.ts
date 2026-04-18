import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
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
      defaultOrgId: c.defaultOrgId,
      defaultDepartmentId: c.defaultDepartmentId,
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
  const { user } = auth;
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

    let defaultOrgId = existing?.defaultOrgId ?? null;
    if (body.defaultOrgId === null || body.defaultOrgId === "") {
      defaultOrgId = null;
    } else if (typeof body.defaultOrgId === "string") {
      defaultOrgId = body.defaultOrgId.trim() || null;
    }

    let defaultDepartmentId = existing?.defaultDepartmentId ?? null;
    if (body.defaultDepartmentId === null || body.defaultDepartmentId === "") {
      defaultDepartmentId = null;
    } else if (typeof body.defaultDepartmentId === "string") {
      defaultDepartmentId = body.defaultDepartmentId.trim() || null;
    }

    await prisma.zohoAssistSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        clientId: nextClientId,
        clientSecret: nextClientSecret,
        refreshToken: nextRefresh,
        dataCenter,
        defaultOrgId,
        defaultDepartmentId,
      },
      update: {
        clientId: nextClientId,
        clientSecret: nextClientSecret,
        refreshToken: nextRefresh,
        dataCenter,
        defaultOrgId,
        defaultDepartmentId,
      },
    });

    const c = await loadZohoAssistSettings();
    const masked = maskZohoSecrets(c);

    await createAuditLog({
      userId: user.id,
      actionType: "integration.zoho.settings_updated",
      notes: "Zoho Assist API credentials or data center saved",
      metadata: {
        dataCenter: c.dataCenter,
        hasClientId: !!c.clientId,
        hasClientSecret: !!(c.clientSecret && c.clientSecret.length > 0),
        hasRefreshToken: !!(c.refreshToken && c.refreshToken.length > 0),
        clearedClientSecret: body.clearClientSecret === true,
        clearedRefreshToken: body.clearRefreshToken === true,
      },
    });

    return NextResponse.json({
      ...masked,
      defaultOrgId: c.defaultOrgId,
      defaultDepartmentId: c.defaultDepartmentId,
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
