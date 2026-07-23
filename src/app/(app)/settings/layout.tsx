import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/get-session-role";

export const metadata: Metadata = {
  title: "Settings · Handicaps Network Africa",
  description:
    "Zoho Assist API, device templates, and audit log for the inventory system",
};

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionRole();
  if (!session) redirect("/login");
  if (!session.role) redirect("/no-access");
  if (session.role === "reports_only") redirect("/reports");
  if (session.role === "operations") redirect("/inventory");
  return children;
}
