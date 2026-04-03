import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";

/**
 * Authenticated session with `super_admin` only (env email allowlist).
 */
export async function requireSuperAdmin(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}
