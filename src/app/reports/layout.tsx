import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports · Handicaps Network Africa",
  description:
    "PDF inventory reports and per-asset lifecycle history for Handicaps Network Africa",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
