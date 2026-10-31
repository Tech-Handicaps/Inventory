import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  type AppRole,
  isProtectedAdminEmail,
  isSuperAdminEmail,
  parseStoredRole,
} from "@/lib/auth/roles";
import { clearActiveUserCache } from "@/lib/auth/verified-user";

/** Per-instance cache; other serverless instances may serve a changed role for up to this long. */
const ROLE_CACHE_TTL_MS = 30_000;
const roleCache = new Map<string, { role: AppRole | null; expires: number }>();

/** Call after changing a user's role, ban state or account. */
export function clearAuthCache(userId?: string) {
  if (userId) roleCache.delete(userId);
  else roleCache.clear();
  clearActiveUserCache(userId);
}

/**
 * Single place to resolve the signed-in user's application role.
 * Prefer this (or `requireApiAuth`) over reading Prisma/Supabase metadata ad hoc.
 *
 * Deny-by-default: users without an env allowlist hit or a UserRole row get `null`
 * (no access). Never elevates from `user_metadata` (user-editable).
 */
export async function resolveAppRole(user: Pick<User, "id" | "email">): Promise<AppRole | null> {
  if (isSuperAdminEmail(user.email ?? null)) {
    return "super_admin";
  }
  if (isProtectedAdminEmail(user.email ?? null)) {
    return "admin";
  }

  const cached = roleCache.get(user.id);
  if (cached && cached.expires > Date.now()) return cached.role;

  const row = await prisma.userRole.findUnique({
    where: { userId: user.id },
  });
  const role = row ? parseStoredRole(row.role) : null;
  roleCache.set(user.id, { role, expires: Date.now() + ROLE_CACHE_TTL_MS });
  return role;
}
