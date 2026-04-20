import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  type AppRole,
  isProtectedAdminEmail,
  isSuperAdminEmail,
  parseStoredRole,
  toStoredRole,
} from "@/lib/auth/roles";

/**
 * Single place to resolve the signed-in user's application role.
 * Prefer this (or `requireApiAuth`) over reading Prisma/Supabase metadata ad hoc.
 */
export async function resolveAppRole(user: User): Promise<AppRole> {
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

  const fromMeta =
    parseStoredRole(user.app_metadata?.role) ??
    parseStoredRole(user.user_metadata?.role);

  if (fromMeta) {
    await prisma.userRole.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role: toStoredRole(fromMeta) },
      update: { role: toStoredRole(fromMeta) },
    });
    return fromMeta;
  }

  return "admin";
}
