import type { AppRole } from "@/lib/auth/roles";

const REPORTS_PREFIX = "/api/reports/";
const ZOHO_SETTINGS_PREFIX = "/api/settings/zoho";
const ZOHO_DESK_SETTINGS_PREFIX = "/api/settings/zoho-desk";
const AUDIT_LOGS_PATH = "/api/audit-logs";
/** Session role for nav — must be reachable by reports_only */
const ME_PATH = "/api/me";

/**
 * Whether `role` may call the given API pathname (e.g. `request.nextUrl.pathname`).
 * super_admin and admin: all routes.
 * reports_only: only `/api/reports/*`.
 * accountant: all except Zoho Assist settings and audit log.
 */
export function apiAccessAllowedForRole(
  pathname: string,
  role: AppRole
): boolean {
  if (role === "super_admin" || role === "admin") {
    return true;
  }

  if (role === "reports_only") {
    if (pathname === ME_PATH) return true;
    return pathname.startsWith(REPORTS_PREFIX);
  }

  if (role === "accountant") {
    if (pathname.startsWith(ZOHO_SETTINGS_PREFIX)) return false;
    if (pathname.startsWith(ZOHO_DESK_SETTINGS_PREFIX)) return false;
    if (pathname === AUDIT_LOGS_PATH) return false;
    return true;
  }

  return false;
}
