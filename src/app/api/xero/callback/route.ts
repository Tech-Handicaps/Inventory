import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";

// GET /api/xero/callback - Xero OAuth2 callback
// Placeholder: implement full OAuth2 flow with xero-node or similar
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?xero_error=${error}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?xero_error=no_code`
    );
  }

  // TODO: Exchange code for tokens, store securely, redirect to dashboard
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?xero=callback_received`
  );
}
