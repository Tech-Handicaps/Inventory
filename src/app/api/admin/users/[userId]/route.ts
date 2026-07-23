import { NextRequest, NextResponse } from "next/server";
import { patchUserSchema } from "@/lib/auth/admin-user-schemas";
import { appRoleForAuthUser } from "@/lib/auth/app-role-for-user";
import { isProtectedAdminEmail, isSuperAdminEmail, toStoredRole } from "@/lib/auth/roles";
import { requireUserAdmin } from "@/lib/auth/require-user-admin";
import { catchToJsonError, jsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

async function countResolvedAdmins(admin: ReturnType<typeof createSupabaseAdmin>) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error(error.message || "Failed to list users");
  const users = data.users;
  const ids = users.map((u) => u.id);
  const rows = await prisma.userRole.findMany({
    where: { userId: { in: ids } },
  });
  const storedById = new Map(rows.map((r) => [r.userId, r.role]));
  return users.reduce((count, u) => {
    const stored = storedById.get(u.id);
    const role = appRoleForAuthUser(u, stored);
    return role === "admin" || role === "super_admin" ? count + 1 : count;
  }, 0);
}

/**
 * PATCH — change assignable role / disable user (admin/super admin only).
 * Body: `{ "role"?: "admin" | "operations" | "reports_only" | "accountant", "disabled"?: boolean }`
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireUserAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { userId } = await params;
  if (!userId?.trim()) {
    return jsonError("Missing user id", 400);
  }

  const parsed = await parseJsonBody(request, patchUserSchema);
  if (isNextResponse(parsed)) return parsed;

  const assignRole = parsed.role;
  const disableRequested = parsed.disabled;

  try {
    const admin = createSupabaseAdmin();
    const { data: userData, error: getErr } =
      await admin.auth.admin.getUserById(userId);
    if (getErr || !userData.user) {
      return jsonError("User not found", 404);
    }

    const u = userData.user;
    if (isSuperAdminEmail(u.email ?? null)) {
      return jsonError(
        "Cannot change role for a super admin (env allowlist).",
        400
      );
    }
    if (isProtectedAdminEmail(u.email ?? null)) {
      return jsonError(
        "This admin account is protected and cannot be changed.",
        400
      );
    }

    const stored = await prisma.userRole.findUnique({
      where: { userId },
    });
    const current = appRoleForAuthUser(u, stored?.role);
    if (current === "super_admin") {
      return jsonError("Cannot change this user’s role.", 400);
    }

    // Safeguard: do not allow removing the last remaining admin.
    if (assignRole && current === "admin" && assignRole !== "admin") {
      const adminCount = await countResolvedAdmins(admin);
      if (adminCount <= 1) {
        return jsonError("Cannot demote the last admin user.", 400);
      }
    }

    const previousStoredRole: string | null = stored?.role ?? null;

    if (assignRole) {
      await prisma.userRole.upsert({
        where: { userId },
        create: { userId, role: toStoredRole(assignRole) },
        update: { role: toStoredRole(assignRole) },
      });
    }

    const update: Record<string, unknown> = {};
    // Prefer app_metadata only (Admin API); do not write user_metadata.role.
    if (assignRole) {
      update.app_metadata = { role: toStoredRole(assignRole) };
    }
    if (disableRequested !== undefined) {
      // Supabase supports ban_duration strings, e.g. "1h". Use a long duration to represent "disabled".
      update.ban_duration = disableRequested ? "876000h" : "none";
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({
        ok: true,
        role: assignRole ?? current,
        disabled: disableRequested,
      });
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, update);
    if (updErr) {
      console.error("PATCH /api/admin/users/[userId] updateUserById", updErr);
      if (assignRole) {
        try {
          if (previousStoredRole) {
            await prisma.userRole.update({
              where: { userId },
              data: { role: previousStoredRole },
            });
          } else {
            await prisma.userRole.delete({ where: { userId } }).catch(() => undefined);
          }
        } catch (rollbackErr) {
          console.error(
            "PATCH /api/admin/users/[userId] role rollback failed",
            rollbackErr
          );
        }
      }
      return jsonError(
        "Failed to update auth user; changes were not applied.",
        502
      );
    }

    return NextResponse.json({
      ok: true,
      role: assignRole ?? current,
      disabled: disableRequested,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return jsonError(
        "Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY for user management.",
        503
      );
    }
    return catchToJsonError("PATCH /api/admin/users/[userId]", e, "Server error");
  }
}
