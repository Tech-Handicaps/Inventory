import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/auth/get-session-role";

export const metadata: Metadata = {
  title: "Hardware board · Handicaps Network Africa",
  description:
    "Board view for hardware lifecycle: new stock, in stock, repairs, refurbished",
};

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionRole();
  if (!session) redirect("/login");
  if (session.role === "reports_only") redirect("/reports");
  return children;
}
