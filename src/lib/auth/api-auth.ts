import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";

function parseRole(raw: unknown): Role | null {
  if (raw !== "accounts" && raw !== "operations" && raw !== "management") {
    return null;
  }
  return raw;
}

/**
 * Resolves role from Prisma or Supabase metadata (for reporting / optional sync).
 * API access does not use this for permission checks — see `requireApiAuth`.
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
 * Authenticates via Supabase session. Any signed-in user has full API access
 * (no role-based restrictions). `role` is always `management` for callers
 * that branch on capability.
 */
export async function requireApiAuth(
  request: NextRequest
): Promise<ApiAuthContext | NextResponse> {
  void request;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user, role: "management" };
}
