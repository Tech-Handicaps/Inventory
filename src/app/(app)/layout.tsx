"use client";

import { AppShell } from "@/components/AppShell";

/**
 * Shared authenticated chrome for dashboard, inventory, assets, reports, etc.
 */
export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
