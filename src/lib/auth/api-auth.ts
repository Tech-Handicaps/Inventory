import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { apiAccessAllowedForRole } from "@/lib/auth/api-route-access";
import type { AppRole } from "@/lib/auth/roles";
import { resolveAppRole } from "@/lib/auth/resolve-app-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ApiAuthContext = { user: User; role: AppRole };

/**
 * Authenticates via Supabase session, resolves `AppRole`, and enforces API access
 * by pathname (`reports_only`, `accountant` exclusions — see `apiAccessAllowedForRole`).
 */
export async function requireApiAuth(
  request: NextRequest
): Promise<ApiAuthContext | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveAppRole(user);
  const pathname = request.nextUrl.pathname;

  if (!apiAccessAllowedForRole(pathname, role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user, role };
}

/** @deprecated Import `resolveAppRole` from `@/lib/auth/resolve-app-role` */
export async function resolveUserRole(user: User): Promise<AppRole> {
  return resolveAppRole(user);
}
