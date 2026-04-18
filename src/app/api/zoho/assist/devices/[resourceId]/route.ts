import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  fetchAssistDeviceDetails,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
} from "@/lib/zoho/client";
import { mapAssistDeviceJsonToHardwareFields } from "@/lib/zoho/assist-device-map";

/**
 * GET /api/zoho/assist/devices/:resourceId
 * Fetches device details from Zoho Assist (for preview / sync into Asset fields).
 * Query: departmentId (optional if saved in Settings), orgId (optional).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { resourceId } = await params;
    if (!resourceId?.trim()) {
      return NextResponse.json({ error: "resourceId required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const qDept = searchParams.get("departmentId")?.trim();
    const qOrg = searchParams.get("orgId")?.trim();

    const c = await loadZohoAssistSettings();
    const departmentId = qDept || c.defaultDepartmentId || "";
    if (!departmentId) {
      return NextResponse.json(
        {
          error:
            "departmentId required (query ?departmentId=… or save Default department in Settings → Zoho Assist)",
        },
        { status: 400 }
      );
    }

    if (!c.clientId || !c.clientSecret || !c.refreshToken) {
      return NextResponse.json(
        { error: "Zoho Assist is not configured (OAuth credentials missing)" },
        { status: 400 }
      );
    }

    const { access_token } = await refreshZohoAccessToken(c);
    const orgId = qOrg || c.defaultOrgId || undefined;
    const raw = await fetchAssistDeviceDetails(access_token, resourceId, {
      departmentId,
      orgId,
    });

    const mapped = mapAssistDeviceJsonToHardwareFields(raw);

    return NextResponse.json({
      raw,
      mapped,
      usedDepartmentId: departmentId,
      usedOrgId: orgId ?? null,
    });
  } catch (e) {
    console.error("GET /api/zoho/assist/devices/[resourceId]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assist device fetch failed" },
      { status: 500 }
    );
  }
}
