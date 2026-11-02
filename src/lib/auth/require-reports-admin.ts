import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { isReportsAdmin } from "@/lib/auth/reports-admin";

export { isReportsAdmin };

/** Editing report notes, period files, aliases and reconciliation lines (admin / super_admin). */
export async function requireReportsAdmin(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!isReportsAdmin(auth.role)) {
    return NextResponse.json({ error: "Only administrators can change this" }, { status: 403 });
  }
  return auth;
}
