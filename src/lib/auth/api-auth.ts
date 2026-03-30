import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequiredRoleForRoute } from "@/lib/auth/route-policy";
import { hasPermission, type Role } from "@/lib/auth/roles";

function parseRole(raw: unknown): Role | null {
  if (raw !== "accounts" && raw !== "operations" && raw !== "management") {
    return null;
  }
  return raw;
}

/**
 * Resolves role: Prisma UserRole row, else Supabase app_metadata / user_metadata.role,
 * else upserts from metadata when valid, else defaults to `operations` (read-heavy).
 */
export async function resolveUserRole(user: User): Promise<Role> {
  const row = await prisma.userRole.findUnique({
    where: { userId: user.id },
  });
  if (row) {
    const r = parseRole(row.role);
    if (r) return r;
  }

  const fromMeta =
    parseRole(user.app_metadata?.role) ??
    parseRole(user.user_metadata?.role);

  if (fromMeta) {
    await prisma.userRole.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role: fromMeta },
      update: { role: fromMeta },
    });
    return fromMeta;
  }

  return "operations";
}

export type ApiAuthContext = { user: User; role: Role };

/**
 * Authenticates via Supabase session and enforces RBAC for this route.
 * Returns 401 if not logged in, 403 if role is insufficient.
 */
export async function requireApiAuth(
  request: NextRequest
): Promise<ApiAuthContext | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let role: Role;
  try {
    role = await resolveUserRole(user);
  } catch (e) {
    console.error("resolveUserRole", e);
    return NextResponse.json(
      {
        error: "Database error",
        detail: "Could not load user permissions. Check DATABASE_URL and migrations.",
      },
      { status: 503 }
    );
  }

  const required = getRequiredRoleForRoute(
    request.method,
    request.nextUrl.pathname
  );

  if (!hasPermission(role, required)) {
    return NextResponse.json(
      {
        error: "Forbidden",
        detail: `This action requires at least the "${required}" role.`,
      },
      { status: 403 }
    );
  }

  return { user, role };
}
