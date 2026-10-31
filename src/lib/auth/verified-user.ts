import type { SupabaseClient, User } from "@supabase/supabase-js";

export type VerifiedUser = Pick<User, "id" | "email" | "user_metadata" | "app_metadata">;

export type VerifiedUserResult =
  | { user: VerifiedUser; error: null }
  | { user: null; error: Error | null };

/**
 * A locally valid JWT outlives a ban or deletion, so the Auth server is still asked
 * whether the account is active, at most once per user per window (per instance).
 */
const ACTIVE_CHECK_TTL_MS = 30_000;
const activeUntil = new Map<string, number>();

export function clearActiveUserCache(userId?: string) {
  if (userId) activeUntil.delete(userId);
  else activeUntil.clear();
}

/**
 * Verifies the session JWT locally against the project's published signing keys.
 * Expired tokens are refreshed by the client first.
 */
export async function getVerifiedUser(supabase: SupabaseClient): Promise<VerifiedUserResult> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { user: null, error: error ?? null };

  if ((activeUntil.get(claims.sub) ?? 0) <= Date.now()) {
    const { data: fresh, error: userError } = await supabase.auth.getUser();
    if (userError || !fresh.user || fresh.user.id !== claims.sub) {
      activeUntil.delete(claims.sub);
      return { user: null, error: userError ?? null };
    }
    activeUntil.set(claims.sub, Date.now() + ACTIVE_CHECK_TTL_MS);
  }

  return {
    user: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : undefined,
      user_metadata: (claims.user_metadata as User["user_metadata"]) ?? {},
      app_metadata: (claims.app_metadata as User["app_metadata"]) ?? {},
    },
    error: null,
  };
}
