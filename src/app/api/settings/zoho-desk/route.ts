import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  loadZohoDeskSettings,
  maskZohoDeskSecrets,
} from "@/lib/zoho/desk";
import { ZOHO_DATA_CENTERS, type ZohoDataCenter } from "@/lib/zoho/constants";

const VALID_DC = new Set(ZOHO_DATA_CENTERS.map((d) => d.value));

function isValidDataCenter(v: string): v is ZohoDataCenter {
  return VALID_DC.has(v as ZohoDataCenter);
}

export async function GET(request: NextRequest) {
  void request;
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const c = await loadZohoDeskSettings();
    const masked = maskZohoDeskSecrets(c);
    return NextResponse.json({
      ...masked,
      readyForOAuth: !!(c.clientId && c.clientSecret),
      canTestApi:
        !!(c.clientId && c.clientSecret && c.refreshToken && c.refreshToken.length > 0),
      canCreateTickets:
        !!(c.orgId?.trim() && c.clientId && c.clientSecret && c.refreshToken),
    });
  } catch (error) {
    console.error("GET /api/settings/zoho-desk", error);
    return NextResponse.json(
      { error: "Failed to load Zoho Desk settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const existing = await prisma.zohoDeskSettings.findUnique({
      where: { id: "singleton" },
    });

    let orgId = existing?.orgId ?? null;
    if (typeof body.orgId === "string") {
      orgId = body.orgId.trim() || null;
    }

    let departmentId = existing?.departmentId ?? null;
    if (body.clearDepartmentId === true) {
      departmentId = null;
    } else if (typeof body.departmentId === "string") {
      departmentId = body.departmentId.trim() || null;
    }

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

    await prisma.zohoDeskSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        orgId,
        departmentId,
        clientId: nextClientId,
        clientSecret: nextClientSecret,
        refreshToken: nextRefresh,
        dataCenter,
      },
      update: {
        orgId,
        departmentId,
        clientId: nextClientId,
        clientSecret: nextClientSecret,
        refreshToken: nextRefresh,
        dataCenter,
      },
    });

    const c = await loadZohoDeskSettings();
    const masked = maskZohoDeskSecrets(c);

    await createAuditLog({
      userId: user.id,
      actionType: "integration.zoho_desk.settings_updated",
      notes: "Zoho Desk API settings saved",
      metadata: {
        dataCenter: c.dataCenter,
        hasOrgId: !!c.orgId,
        hasDepartmentId: !!c.departmentId,
        hasClientId: !!c.clientId,
        hasClientSecret: !!(c.clientSecret && c.clientSecret.length > 0),
        hasRefreshToken: !!(c.refreshToken && c.refreshToken.length > 0),
      },
    });

    return NextResponse.json({
      ...masked,
      readyForOAuth: !!(c.clientId && c.clientSecret),
      canTestApi:
        !!(c.clientId && c.clientSecret && c.refreshToken && c.refreshToken.length > 0),
      canCreateTickets:
        !!(c.orgId?.trim() && c.clientId && c.clientSecret && c.refreshToken),
    });
  } catch (error) {
    console.error("PUT /api/settings/zoho-desk", error);
    return NextResponse.json(
      { error: "Failed to save Zoho Desk settings" },
      { status: 500 }
    );
  }
}
