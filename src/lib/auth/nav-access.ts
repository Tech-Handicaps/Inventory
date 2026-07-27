import type { AppRole } from "@/lib/auth/roles";

export type NavKey =
  | "dashboard"
  | "inventory"
  | "assets"
  | "reports"
  | "acknowledgements"
  | "settings";

/**
 * Which primary nav links to show for a role.
 * While `role` is unknown (loading), callers may show operational links and hide
 * settings / acknowledgements until the role is resolved.
 */
export function hasFullNavAccess(
  role: AppRole | null | undefined
): boolean {
  return role === "admin" || role === "super_admin";
}

export function isNavLinkVisible(role: AppRole, key: NavKey): boolean {
  if (key === "acknowledgements") {
    return role === "admin" || role === "super_admin" || role === "accountant";
  }
  if (role === "reports_only") {
    return key === "reports";
  }
  if (role === "operations") {
    return key !== "settings";
  }
  return true;
}
