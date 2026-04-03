import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/get-session-role";

export const metadata: Metadata = {
  title: "Dashboard · Handicaps Network Africa",
  description: "Stock, repairs, refurbishment, and Xero health at a glance",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionRole();
  if (!session) redirect("/login");
  if (session.role === "reports_only") redirect("/reports");
  return children;
}
