import { NextRequest, NextResponse } from "next/server";
import {
  parseAssignableRole,
  type AssignableRole,
} from "@/lib/auth/assignable-roles";
import { appRoleForAuthUser } from "@/lib/auth/app-role-for-user";
import { isProtectedAdminEmail, isSuperAdminEmail, toStoredRole } from "@/lib/auth/roles";
import { requireUserAdmin } from "@/lib/auth/require-user-admin";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function loginRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  return `${base}/login`;
}

/**
 * GET — list auth users with resolved app roles (super admin only).
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const admin = createSupabaseAdmin();
    const page = Math.max(
      1,
      parseInt(request.nextUrl.searchParams.get("page") || "1", 10) || 1
    );
    const perPage = Math.min(
      200,
      Math.max(
        1,
        parseInt(request.nextUrl.searchParams.get("perPage") || "100", 10) || 100
      )
    );

    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to list users" },
        { status: 500 }
      );
    }

    const users = data.users;
    const ids = users.map((u) => u.id);
    const rows = await prisma.userRole.findMany({
      where: { userId: { in: ids } },
    });
    const roleByUserId = new Map(rows.map((r) => [r.userId, r.role]));

    const items = users.map((u) => {
      const stored = roleByUserId.get(u.id);
      const role = appRoleForAuthUser(u, stored);
      return {
        id: u.id,
        email: u.email ?? "",
        role,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        readOnly: isSuperAdminEmail(u.email ?? null) || isProtectedAdminEmail(u.email ?? null),
        disabled: Boolean((u as { banned_until?: string | null }).banned_until),
      };
    });

    return NextResponse.json({
      items,
      page,
      perPage,
      total: data.total ?? items.length,
    });
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
    console.error("GET /api/admin/users", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — invite by email or update role if the user already exists (super admin only).
 * Body: `{ "email": string, "role": "admin" | "reports_only" | "accountant" }`
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailRaw =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : null;
  const roleRaw =
    typeof body === "object" && body !== null && "role" in body
      ? (body as { role: unknown }).role
      : null;

  const email =
    typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const assignRole = parseAssignableRole(roleRaw);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!assignRole) {
    return NextResponse.json(
      { error: "role must be admin, reports_only, or accountant" },
      { status: 400 }
    );
  }

  if (isSuperAdminEmail(email)) {
    return NextResponse.json(
      { error: "Super admin access is controlled via SUPER_ADMIN_EMAILS, not invites." },
      { status: 400 }
    );
  }
  if (isProtectedAdminEmail(email)) {
    return NextResponse.json(
      { error: "This admin account is protected and cannot be invited/changed via the UI." },
      { status: 400 }
    );
  }

  try {
    const admin = createSupabaseAdmin();
    const redirectTo = loginRedirectUrl();

    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      return NextResponse.json(
        { error: listErr.message || "Failed to look up users" },
        { status: 500 }
      );
    }

    const existing = listData.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existing) {
      if (isProtectedAdminEmail(existing.email ?? null)) {
        return NextResponse.json(
          { error: "This admin account is protected and cannot be changed." },
          { status: 400 }
        );
      }

      // Safeguard: do not allow demoting the last remaining admin.
      const currentStored = await prisma.userRole.findUnique({
        where: { userId: existing.id },
      });
      const currentRole = appRoleForAuthUser(existing, currentStored?.role);
      if (currentRole === "admin" && assignRole !== "admin") {
        const ids = listData.users.map((u) => u.id);
        const rows = await prisma.userRole.findMany({
          where: { userId: { in: ids } },
        });
        const roleById = new Map(rows.map((r) => [r.userId, r.role]));
        const adminCount = listData.users.reduce((count, u) => {
          const stored = roleById.get(u.id);
          const r = appRoleForAuthUser(u, stored);
          return r === "admin" ? count + 1 : count;
        }, 0);
        if (adminCount <= 1) {
          return NextResponse.json(
            { error: "Cannot demote the last admin user." },
            { status: 400 }
          );
        }
      }

      await syncUserRole(admin, existing.id, assignRole);
      return NextResponse.json({
        ok: true,
        action: "updated",
        userId: existing.id,
        message: "User already existed; role updated.",
      });
    }

    const { data: invited, error: invErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { role: toStoredRole(assignRole) },
        redirectTo,
      });

    if (invErr) {
      return NextResponse.json(
        { error: invErr.message || "Invite failed" },
        { status: 400 }
      );
    }

    const newUser = invited.user;
    if (newUser?.id) {
      await prisma.userRole.upsert({
        where: { userId: newUser.id },
        create: { userId: newUser.id, role: toStoredRole(assignRole) },
        update: { role: toStoredRole(assignRole) },
      });
    }

    return NextResponse.json({
      ok: true,
      action: "invited",
      userId: newUser?.id ?? null,
      message: "Invitation email sent (if SMTP is configured in Supabase).",
    });
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
    console.error("POST /api/admin/users", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function syncUserRole(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  assignRole: AssignableRole
) {
  const stored = toStoredRole(assignRole);
  await prisma.userRole.upsert({
    where: { userId },
    create: { userId, role: stored },
    update: { role: stored },
  });
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { role: stored },
  });
  if (error) {
    console.error("updateUserById metadata", error);
  }
}
