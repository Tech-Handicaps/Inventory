import { NextRequest, NextResponse } from "next/server";
import { inviteUserSchema } from "@/lib/auth/admin-user-schemas";
import {
  type AssignableRole,
} from "@/lib/auth/assignable-roles";
import { appRoleForAuthUser } from "@/lib/auth/app-role-for-user";
import { isProtectedAdminEmail, isSuperAdminEmail, toStoredRole } from "@/lib/auth/roles";
import { requireUserAdmin } from "@/lib/auth/require-user-admin";
import { catchToJsonError, jsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
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
        { error: "Failed to list users" },
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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST — invite by email or update role if the user already exists (super admin only).
 * Body: `{ "email": string, "role": "admin" | "operations" | "reports_only" | "accountant" }`
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJsonBody(request, inviteUserSchema);
  if (isNextResponse(parsed)) return parsed;

  const { email, role: assignRole } = parsed;

  if (isSuperAdminEmail(email)) {
    return jsonError(
      "Super admin access is controlled via SUPER_ADMIN_EMAILS, not invites.",
      400
    );
  }
  if (isProtectedAdminEmail(email)) {
    return jsonError(
      "This admin account is protected and cannot be invited/changed via the UI.",
      400
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
      return jsonError("Failed to look up users", 500);
    }

    const existing = listData.users.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (existing) {
      if (isProtectedAdminEmail(existing.email ?? null)) {
        return jsonError(
          "This admin account is protected and cannot be changed.",
          400
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
          return jsonError("Cannot demote the last admin user.", 400);
        }
      }

      await syncUserRole(
        admin,
        existing.id,
        assignRole,
        currentStored?.role ?? null
      );
      return NextResponse.json({
        ok: true,
        action: "updated",
        userId: existing.id,
        message: "User already existed; role updated.",
      });
    }

    const { data: invited, error: invErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });

    if (invErr) {
      console.error("POST /api/admin/users inviteUserByEmail", invErr);
      return jsonError("Invite failed", 400);
    }

    const newUser = invited.user;
    if (!newUser?.id) {
      console.error("POST /api/admin/users invite returned no user id", invited);
      return jsonError(
        "Invite did not return a user id; role was not assigned.",
        502
      );
    }

    try {
      await syncUserRole(admin, newUser.id, assignRole, null);
    } catch (syncErr) {
      console.error("POST /api/admin/users invite syncUserRole", syncErr);
      return jsonError(
        "User invited but role sync failed; assign a role manually.",
        502
      );
    }

    return NextResponse.json({
      ok: true,
      action: "invited",
      userId: newUser.id,
      message: "Invitation email sent (if SMTP is configured in Supabase).",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return jsonError(
        "Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY for user management.",
        503
      );
    }
    if (message === "Failed to sync role to Auth") {
      return jsonError("Failed to sync role to Auth", 502);
    }
    return catchToJsonError("POST /api/admin/users", e, "Server error");
  }
}

async function syncUserRole(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  assignRole: AssignableRole,
  previousStoredRole: string | null
) {
  const stored = toStoredRole(assignRole);
  await prisma.userRole.upsert({
    where: { userId },
    create: { userId, role: stored },
    update: { role: stored },
  });
  // Prefer app_metadata only (Admin API); do not write user_metadata.role.
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: stored },
  });
  if (error) {
    console.error("POST /api/admin/users syncUserRole updateUserById", error);
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
      console.error("POST /api/admin/users syncUserRole role rollback failed", rollbackErr);
    }
    throw new Error("Failed to sync role to Auth");
  }
}
