import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";

/**
 * Authenticated session with `admin` or `super_admin`.
 * Used for privileged actions like user management.
 */
export async function requireUserAdmin(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "admin" && auth.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}

