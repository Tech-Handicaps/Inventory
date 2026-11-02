import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { SessionRoleProvider } from "@/components/SessionRoleProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastProvider } from "@/components/ToastProvider";
import { getSessionRole } from "@/lib/auth/get-session-role";
import { fontBody } from "@/lib/fonts";
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
  const session = getSessionRole()
    .then((s) => (s ? { role: s.role, email: s.email, displayName: s.displayName } : null))
    .catch((e) => {
      console.error("root layout: session lookup failed", e);
      return null;
    });

  return (
    <html
      lang="en"
      className={`${fontBody.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${fontBody.className} min-h-full flex flex-col`}>
        <ToastProvider>
          <SessionRoleProvider session={session}>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </SessionRoleProvider>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
