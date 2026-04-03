"use client";

import { useAppRole } from "@/components/RoleProvider";
import { AssetLifecycleSection } from "./asset-lifecycle-section";

/** Renders lifecycle block only when the role may use assets; audit timeline only for admin/super_admin. */
export function ReportsLifecycleSlot() {
  const { role, loading } = useAppRole();

  if (loading || role === null) return null;
  if (role === "reports_only") return null;

  const auditAccess = role === "super_admin" || role === "admin";
  return <AssetLifecycleSection auditAccess={auditAccess} />;
}
