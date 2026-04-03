import type { AppRole } from "@/lib/auth/roles";

/** Roles that can be assigned in the UI (never `super_admin`). */
export const ASSIGNABLE_ROLES = [
  "admin",
  "reports_only",
  "accountant",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function parseAssignableRole(raw: unknown): AssignableRole | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if ((ASSIGNABLE_ROLES as readonly string[]).includes(key)) {
    return key as AssignableRole;
  }
  return null;
}

/** Display label for assignable + super_admin (read-only in UI). */
export function roleLabel(role: AppRole): string {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "admin":
      return "Admin";
    case "reports_only":
      return "Reports only";
    case "accountant":
      return "Accountant / auditor";
    default:
      return role;
  }
}
