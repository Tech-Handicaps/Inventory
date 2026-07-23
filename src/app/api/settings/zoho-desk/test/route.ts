import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { testZohoDeskConnection } from "@/lib/zoho/desk";

export async function POST(request: NextRequest) {
  void request;
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await testZohoDeskConnection();
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/settings/zoho-desk/test", e);
    return NextResponse.json(
      { ok: false, error: "Desk test failed" },
      { status: 400 }
    );
  }
}
