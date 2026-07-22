import type { User } from "@supabase/supabase-js";
import {
  type AppRole,
  isProtectedAdminEmail,
  isSuperAdminEmail,
  parseStoredRole,
} from "@/lib/auth/roles";

/**
 * Resolve app role for a Supabase Auth user (same rules as `resolveAppRole`,
 * without DB read — pass `storedRole` from UserRole when known).
 * Deny-by-default; does not trust user_metadata or app_metadata.
 */
export function appRoleForAuthUser(
  user: User,
  storedRole?: string | null
): AppRole | null {
  if (isSuperAdminEmail(user.email ?? null)) {
    return "super_admin";
  }
  if (isProtectedAdminEmail(user.email ?? null)) {
    return "admin";
  }
  if (storedRole) {
    const p = parseStoredRole(storedRole);
    if (p) return p;
  }
  return null;
}
