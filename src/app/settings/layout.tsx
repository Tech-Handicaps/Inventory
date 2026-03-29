import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings · Handicaps Network Africa",
  description:
    "Zoho Assist API connection and device templates for the inventory system",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
