import { NextRequest, NextResponse } from "next/server";
import { createUserSchema } from "@/lib/auth/admin-user-schemas";
import { isProtectedAdminEmail, isSuperAdminEmail, toStoredRole } from "@/lib/auth/roles";
import { requireUserAdmin } from "@/lib/auth/require-user-admin";
import { catchToJsonError, jsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/admin/users/create — create Auth user with password + username + role.
 * Body: `{ username, email, firstName, lastName, password, role }`
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJsonBody(request, createUserSchema);
  if (isNextResponse(parsed)) return parsed;

  const { username, email, password, role: assignRole, firstName, lastName } =
    parsed;

  if (isSuperAdminEmail(email)) {
    return jsonError(
      "Super admin access is controlled via SUPER_ADMIN_EMAILS, not user create.",
      400
    );
  }
  if (isProtectedAdminEmail(email)) {
    return jsonError(
      "This admin account is protected and cannot be created/changed via the UI.",
      400
    );
  }

  try {
    const existingUsername = await prisma.userProfile.findUnique({
      where: { username },
      select: { userId: true },
    });
    if (existingUsername) {
      return jsonError("That username is already taken.", 409, {
        code: "USERNAME_TAKEN",
      });
    }

    const admin = createSupabaseAdmin();
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      return jsonError("Failed to look up users", 500);
    }
    if (listData.users.some((u) => u.email?.toLowerCase() === email)) {
      return jsonError("A user with that email already exists.", 409, {
        code: "EMAIL_TAKEN",
      });
    }

    const storedRole = toStoredRole(assignRole);
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: storedRole },
      });

    if (createErr || !created.user?.id) {
      console.error("POST /api/admin/users/create createUser", createErr);
      const msg = createErr?.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered")) {
        return jsonError("A user with that email already exists.", 409, {
          code: "EMAIL_TAKEN",
        });
      }
      return jsonError("Failed to create user", 400);
    }

    const userId = created.user.id;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.userRole.upsert({
          where: { userId },
          create: { userId, role: storedRole },
          update: { role: storedRole },
        });
        await tx.userProfile.create({
          data: { userId, username, firstName, lastName, email },
        });
      });
    } catch (dbErr) {
      console.error("POST /api/admin/users/create prisma", dbErr);
      await admin.auth.admin.deleteUser(userId).catch((rollbackErr) => {
        console.error(
          "POST /api/admin/users/create Auth rollback failed",
          rollbackErr
        );
      });
      const message = dbErr instanceof Error ? dbErr.message : "";
      if (message.includes("Unique constraint") || message.includes("P2002")) {
        return jsonError("That username is already taken.", 409, {
          code: "USERNAME_TAKEN",
        });
      }
      return jsonError("User created in Auth but profile save failed.", 502);
    }

    return NextResponse.json({
      ok: true,
      action: "created",
      userId,
      username,
      email,
      firstName,
      lastName,
      role: assignRole,
      message: "User created. They can sign in with username or email.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return jsonError(
        "Server misconfiguration: set SUPABASE_SERVICE_ROLE_KEY for user management.",
        503
      );
    }
    return catchToJsonError("POST /api/admin/users/create", e, "Server error");
  }
}
