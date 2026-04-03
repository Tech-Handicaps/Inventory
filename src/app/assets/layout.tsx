import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/get-session-role";

export const metadata: Metadata = {
  title: "All assets · Handicaps Network Africa",
  description: "Register hardware and browse every unit in one list",
};

export default async function AssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionRole();
  if (!session) redirect("/login");
  if (session.role === "reports_only") redirect("/reports");
  return children;
}
