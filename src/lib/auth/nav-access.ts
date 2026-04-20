import type { AppRole } from "@/lib/auth/roles";

export type NavKey =
  | "home"
  | "dashboard"
  | "inventory"
  | "assets"
  | "reports"
  | "acknowledgements"
  | "settings";

/**
 * Which primary nav links to show for a role.
 * While `role` is unknown (loading), callers typically show the full set.
 */
export function isNavLinkVisible(role: AppRole, key: NavKey): boolean {
  if (key === "acknowledgements") {
    return role === "admin" || role === "super_admin" || role === "accountant";
  }
  if (role === "reports_only") {
    return key === "home" || key === "reports";
  }
  if (role === "operations") {
    return key !== "settings";
  }
  return true;
}
