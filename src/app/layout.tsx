import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { fontBody, fontHeading } from "@/lib/fonts";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hardware inventory · Handicaps Network Africa",
  description:
    "Hardware lifecycle tracking for Handicaps Network Africa — stock, repairs, and refurbishment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontBody.variable} ${fontHeading.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${fontBody.className} min-h-full flex flex-col`}>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
