import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports · Handicaps Network Africa",
  description:
    "Download PDF inventory reports for stakeholders and accounting",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
