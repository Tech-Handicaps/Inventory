/**
 * APIs that may be called without a session (handlers enforce their own auth/secrets).
 * Kept separate from `proxy.ts` so unit tests do not import the Next.js proxy runtime.
 */
export function isPublicApiPath(pathname: string): boolean {
  return pathname === "/api/health" || pathname.startsWith("/api/cron/");
}
