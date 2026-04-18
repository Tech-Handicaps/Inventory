import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { extractAssistListRows } from "@/lib/zoho/assist-device-map";
import {
  fetchAssistDevicesList,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
} from "@/lib/zoho/client";

/**
 * GET /api/zoho/assist/devices — list unattended devices (Assist GET /api/v2/devices).
 * Query: departmentId?, orgId?, index?, count?, display_name? (passed through).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const qDept = searchParams.get("departmentId")?.trim();
    const qOrg = searchParams.get("orgId")?.trim();
    const index = Math.max(1, parseInt(searchParams.get("index") ?? "1", 10) || 1);
    /** Assist API allows count 1–50 only (OUT_OF_RANGE otherwise). */
    const count = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("count") ?? "50", 10) || 50)
    );
    const displayName = searchParams.get("display_name")?.trim();

    const c = await loadZohoAssistSettings();
    const departmentId = qDept || c.defaultDepartmentId || "";
    if (!departmentId) {
      return NextResponse.json(
        {
          error:
            "departmentId required (?departmentId= or set Default department in Settings → Zoho Assist)",
        },
        { status: 400 }
      );
    }

    if (!c.clientId || !c.clientSecret || !c.refreshToken) {
      return NextResponse.json(
        { error: "Zoho Assist is not configured" },
        { status: 400 }
      );
    }

    const { access_token } = await refreshZohoAccessToken(c);
    const orgId = qOrg || c.defaultOrgId || undefined;

    const raw = await fetchAssistDevicesList(access_token, {
      departmentId,
      orgId,
      index,
      count,
      displayName: displayName || undefined,
    });

    const rows = extractAssistListRows(raw).map((r) => ({
      resourceId: r.resourceId,
      displayName: r.displayName,
      deviceName: r.deviceName,
    }));

    return NextResponse.json({
      rows,
      usedDepartmentId: departmentId,
      usedOrgId: orgId ?? null,
      index,
      count,
    });
  } catch (e) {
    console.error("GET /api/zoho/assist/devices", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assist list failed" },
      { status: 500 }
    );
  }
}
