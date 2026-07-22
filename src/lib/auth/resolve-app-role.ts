import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  type AppRole,
  isProtectedAdminEmail,
  isSuperAdminEmail,
  parseStoredRole,
} from "@/lib/auth/roles";

/**
 * Single place to resolve the signed-in user's application role.
 * Prefer this (or `requireApiAuth`) over reading Prisma/Supabase metadata ad hoc.
 *
 * Deny-by-default: users without an env allowlist hit or a UserRole row get `null`
 * (no access). Never elevates from `user_metadata` (user-editable).
 */
export async function resolveAppRole(user: User): Promise<AppRole | null> {
  if (isSuperAdminEmail(user.email ?? null)) {
    return "super_admin";
  }
  if (isProtectedAdminEmail(user.email ?? null)) {
    return "admin";
  }

  const row = await prisma.userRole.findUnique({
    where: { userId: user.id },
  });
  if (row) {
    const r = parseStoredRole(row.role);
    if (r) return r;
  }

  return null;
}
