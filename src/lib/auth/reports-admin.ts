import type { AppRole } from "@/lib/auth/roles";

/** Who may edit report notes, period files, aliases, reconciliation lines and resend packs. */
export function isReportsAdmin(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}
