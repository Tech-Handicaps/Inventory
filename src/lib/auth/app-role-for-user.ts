import type { User } from "@supabase/supabase-js";
import {
  type AppRole,
  isSuperAdminEmail,
  parseStoredRole,
} from "@/lib/auth/roles";

/**
 * Resolve app role for a Supabase Auth user (same rules as `resolveAppRole`, without DB read for prisma row — pass `storedRole` from UserRole when known).
 */
export function appRoleForAuthUser(
  user: User,
  storedRole?: string | null
): AppRole {
  if (isSuperAdminEmail(user.email ?? null)) {
    return "super_admin";
  }
  if (storedRole) {
    const p = parseStoredRole(storedRole);
    if (p) return p;
  }
  const fromMeta =
    parseStoredRole(user.app_metadata?.role) ??
    parseStoredRole(user.user_metadata?.role);
  if (fromMeta) return fromMeta;
  return "admin";
}
