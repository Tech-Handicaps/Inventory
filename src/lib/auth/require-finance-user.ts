import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";

/** Finance queue + acknowledgement actions (admin / super_admin / accountant). */
export async function requireFinanceAckUser(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (
    auth.role !== "admin" &&
    auth.role !== "super_admin" &&
    auth.role !== "accountant"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return auth;
}
