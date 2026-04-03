import type { AppRole } from "@/lib/auth/roles";
import { resolveAppRole } from "@/lib/auth/resolve-app-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SessionWithRole = {
  userId: string;
  email: string | undefined;
  role: AppRole;
};

/**
 * Resolves the current Supabase user and app role (for server layouts / redirects).
 */
export async function getSessionRole(): Promise<SessionWithRole | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const role = await resolveAppRole(user);
  return {
    userId: user.id,
    email: user.email,
    role,
  };
}
