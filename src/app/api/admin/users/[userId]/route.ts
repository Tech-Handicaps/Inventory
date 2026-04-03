import { NextRequest, NextResponse } from "next/server";
import {
  parseAssignableRole,
} from "@/lib/auth/assignable-roles";
import { appRoleForAuthUser } from "@/lib/auth/app-role-for-user";
import { isSuperAdminEmail } from "@/lib/auth/roles";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { toStoredRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * PATCH — change assignable role for an existing user (super admin only).
 * Body: `{ "role": "admin" | "reports_only" | "accountant" }`
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
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
  const assignRole = parseAssignableRole(roleRaw);
  if (!assignRole) {
    return NextResponse.json(
      { error: "role must be admin, reports_only, or accountant" },
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

    const stored = await prisma.userRole.findUnique({
      where: { userId },
    });
    const current = appRoleForAuthUser(u, stored?.role);
    if (current === "super_admin") {
      return NextResponse.json({ error: "Cannot change this user’s role." }, { status: 400 });
    }

    await prisma.userRole.upsert({
      where: { userId },
      create: { userId, role: toStoredRole(assignRole) },
      update: { role: toStoredRole(assignRole) },
    });

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { role: toStoredRole(assignRole) },
    });
    if (updErr) {
      console.error("updateUserById", updErr);
    }

    return NextResponse.json({ ok: true, role: assignRole });
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
