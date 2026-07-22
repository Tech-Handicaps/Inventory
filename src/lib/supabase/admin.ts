import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for Auth Admin API (invite, list users). Server-only; never import in client components.
 *
 * Trust boundary: this key bypasses Supabase Auth RLS on Auth Admin operations.
 * Application data is accessed via Prisma + DATABASE_URL (not PostgREST). Keep the
 * service role off the client and rotate if leaked. OAuth secrets for Zoho live in
 * Prisma settings tables — restrict who can call `/api/settings/zoho*`.
 */
export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
