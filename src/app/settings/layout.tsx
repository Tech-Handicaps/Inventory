import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings · Handicaps Network Africa",
  description:
    "Zoho Assist API, device templates, and audit log for the inventory system",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
