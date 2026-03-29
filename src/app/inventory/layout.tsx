import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hardware board · Handicaps Network Africa",
  description:
    "Board view for hardware lifecycle: new stock, in stock, repairs, refurbished",
};

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
