/**
 * Allow only same-origin relative paths for post-login redirects.
 * Rejects protocol-relative (`//evil.com`), schemes, and backslashes.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/inventory"
): string {
  if (typeof raw !== "string") return fallback;
  const path = raw.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.includes("\\")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return fallback;
  return path;
}
