import { cache } from "react";
import { redirect } from "next/navigation";
import { displayNameFromUser } from "@/lib/auth/display-name";
import type { AppRole } from "@/lib/auth/roles";
import { resolveAppRole } from "@/lib/auth/resolve-app-role";
import { getVerifiedUser } from "@/lib/auth/verified-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SessionWithRole = {
  userId: string;
  email: string | undefined;
  displayName: string;
  /** Null when authenticated but no UserRole / allowlist hit (deny-by-default). */
  role: AppRole | null;
};

/**
 * Resolves the current Supabase user and app role (for server layouts / redirects).
 * Memoised per request, so the root layout, section layout and page share one lookup.
 */
export const getSessionRole = cache(async (): Promise<SessionWithRole | null> => {
  const supabase = await createServerSupabaseClient();
  const { user } = await getVerifiedUser(supabase);

  if (!user) return null;

  const role = await resolveAppRole(user);
  return {
    userId: user.id,
    email: user.email,
    displayName: displayNameFromUser(user),
    role,
  };
});

/**
 * For server pages that load data directly: same gate as the inventory/assets/dashboard
 * layouts (layouts and pages render in parallel, so the page must not rely on the layout).
 */
export async function requireOperationalSession(): Promise<
  SessionWithRole & { role: AppRole }
> {
  const session = await getSessionRole();
  if (!session) redirect("/login");
  if (!session.role) redirect("/no-access");
  if (session.role === "reports_only") redirect("/reports");
  return session as SessionWithRole & { role: AppRole };
}
