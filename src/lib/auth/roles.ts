// Role-based access control - matches spec
export type Role = "accounts" | "operations" | "management";

export const ROLE_HIERARCHY: Record<Role, number> = {
  management: 3, // highest - full access
  accounts: 2,
  operations: 1,
};

export function hasPermission(userRole: Role | null, requiredRole: Role): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

