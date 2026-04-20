import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/get-session-role";

export const metadata: Metadata = {
  title: "Acknowledgements · Handicaps Network Africa",
  description:
    "Finance acknowledgement queue for repairs and write-offs",
};

export default async function AcknowledgementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionRole();
  if (!session) redirect("/login");
  if (session.role === "reports_only") redirect("/reports");
  if (session.role === "operations") redirect("/inventory");
  if (
    session.role !== "admin" &&
    session.role !== "super_admin" &&
    session.role !== "accountant"
  ) {
    redirect("/inventory");
  }
  return children;
}
