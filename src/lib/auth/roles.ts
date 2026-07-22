/**
 * Application roles. Enforced on API routes and UI.
 *
 * - super_admin: SUPER_ADMIN_EMAILS env allowlist only (cannot be assigned via DB/UI).
 * - admin: full access; also PROTECTED_ADMIN_EMAILS (and built-in protected defaults).
 * - operations: inventory/assets/repairs/reports; no settings, admin users, finance, audit.
 * - reports_only: `/api/reports/*` + `/api/me` only.
 * - accountant: most APIs including finance; no Zoho settings or audit logs.
 *
 * Users with no UserRole row and not on an env allowlist have no role (deny-by-default).
 */

export type AppRole =
  | "super_admin"
  | "admin"
  | "operations"
  | "reports_only"
  | "accountant";

/** @deprecated Use AppRole */
export type Role = AppRole;

const APP_ROLES_NO_SUPER: readonly AppRole[] = [
  "admin",
  "operations",
  "reports_only",
  "accountant",
];

const LEGACY_TO_APP: Record<string, AppRole> = {
  management: "admin",
  accounts: "accountant",
  operations: "operations",
};

/**
 * Normalize a DB or Supabase metadata string to an AppRole.
 * Does not return super_admin — that comes only from `isSuperAdminEmail` in `resolveAppRole`.
 */
export function parseStoredRole(raw: unknown): AppRole | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (key === "super_admin") return null;
  const legacy = LEGACY_TO_APP[key];
  if (legacy) return legacy;
  if ((APP_ROLES_NO_SUPER as readonly string[]).includes(key)) {
    return key as AppRole;
  }
  return null;
}

/**
 * Comma-separated emails (case-insensitive). Grants super_admin in `resolveAppRole`.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const raw = process.env.SUPER_ADMIN_EMAILS?.trim();
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

/**
 * Emails that must always retain full admin access (case-insensitive).
 * Defaults to Shafiek's account to ensure it cannot be demoted/disabled accidentally.
 * Override/extend with a comma-separated env var in production.
 */
export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const raw = process.env.PROTECTED_ADMIN_EMAILS?.trim();
  const fromEnv = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const defaults = ["shafiek@handicaps.co.za"];
  return [...defaults, ...fromEnv].includes(normalized);
}

/** Role string safe to persist on UserRole (never super_admin). */
export function toStoredRole(role: AppRole): string {
  if (role === "super_admin") return "admin";
  return role;
}
