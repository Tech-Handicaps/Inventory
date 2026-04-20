import { NextRequest, NextResponse } from "next/server";
import {
  parseAssignableRole,
} from "@/lib/auth/assignable-roles";
import { appRoleForAuthUser } from "@/lib/auth/app-role-for-user";
import { isProtectedAdminEmail, isSuperAdminEmail, toStoredRole } from "@/lib/auth/roles";
import { requireUserAdmin } from "@/lib/auth/require-user-admin";
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
    return role === "admin" ? count + 1 : count;
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
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const roleRaw =
    typeof body === "object" && body !== null && "role" in body
      ? (body as { role: unknown }).role
      : null;
  const disabledRaw =
    typeof body === "object" && body !== null && "disabled" in body
      ? (body as { disabled: unknown }).disabled
      : undefined;

  const assignRole = roleRaw === null ? null : parseAssignableRole(roleRaw);
  const disableRequested =
    disabledRaw === undefined ? undefined : disabledRaw === true;

  if (assignRole === null && disableRequested === undefined) {
    return NextResponse.json(
      { error: "Provide role and/or disabled flag" },
      { status: 400 }
    );
  }
  if (assignRole === null && roleRaw !== null) {
    return NextResponse.json(
      { error: "role must be admin, operations, reports_only, or accountant" },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdmin();
    const { data: userData, error: getErr } =
      await admin.auth.admin.getUserById(userId);
    if (getErr || !userData.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const u = userData.user;
    if (isSuperAdminEmail(u.email ?? null)) {
      return NextResponse.json(
        { error: "Cannot change role for a super admin (env allowlist)." },
        { status: 400 }
      );
    }
    if (isProtectedAdminEmail(u.email ?? null)) {
      return NextResponse.json(
        { error: "This admin account is protected and cannot be changed." },
        { status: 400 }
      );
    }

    const stored = await prisma.userRole.findUnique({
      where: { userId },
    });
    const current = appRoleForAuthUser(u, stored?.role);
    if (current === "super_admin") {
      return NextResponse.json({ error: "Cannot change this user’s role." }, { status: 400 });
    }

    // Safeguard: do not allow removing the last remaining admin.
    if (assignRole && current === "admin" && assignRole !== "admin") {
      const adminCount = await countResolvedAdmins(admin);
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last admin user." },
          { status: 400 }
        );
      }
    }

    if (assignRole) {
      await prisma.userRole.upsert({
        where: { userId },
        create: { userId, role: toStoredRole(assignRole) },
        update: { role: toStoredRole(assignRole) },
      });
    }

    const nextMeta: Record<string, unknown> = {};
    if (assignRole) nextMeta.role = toStoredRole(assignRole);
    const update: Record<string, unknown> = Object.keys(nextMeta).length
      ? { user_metadata: nextMeta }
      : {};
    if (disableRequested !== undefined) {
      // Supabase supports ban_duration strings, e.g. "1h". Use a long duration to represent "disabled".
      update.ban_duration = disableRequested ? "876000h" : "none";
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, update);
    if (updErr) {
      console.error("updateUserById", updErr);
    }

    return NextResponse.json({ ok: true, role: assignRole ?? current, disabled: disableRequested });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY for user management.",
        },
        { status: 503 }
      );
    }
    console.error("PATCH /api/admin/users/[userId]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
