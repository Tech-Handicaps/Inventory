import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { testZohoAssistConnection } from "@/lib/zoho/client";

// POST /api/settings/zoho/test — refresh token → Assist GET /api/v2/user
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await testZohoAssistConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/settings/zoho/test", error);
    return NextResponse.json(
      { ok: false, error: "Zoho Assist API test failed" },
      { status: 400 }
    );
  }
}
