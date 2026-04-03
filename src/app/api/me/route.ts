import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";

/**
 * Current session role for client nav / UX (allowed for all authenticated roles).
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ role: auth.role });
}
