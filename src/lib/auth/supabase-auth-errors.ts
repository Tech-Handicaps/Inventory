/**
 * Supabase `getUser()` returns an error when there is no session cookie.
 * That is logged-out, not an auth-service outage.
 */
export function isSupabaseAuthSessionMissingError(error: {
  name?: string;
  message?: string;
}): boolean {
  const msg = (error.message || "").toLowerCase();
  return (
    error.name === "AuthSessionMissingError" ||
    msg.includes("auth session missing") ||
    msg.includes("session missing")
  );
}
