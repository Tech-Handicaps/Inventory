import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { displayNameFromUser } from "@/lib/auth/display-name";

/**
 * Current session role and display name for client nav / UX.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({
    role: auth.role,
    displayName: displayNameFromUser(auth.user),
    email: auth.user.email ?? null,
  });
}
