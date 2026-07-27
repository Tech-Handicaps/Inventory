"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Site footer for public/auth entry pages only — hidden inside the app shell.
 */
export function SiteFooter() {
  const pathname = usePathname();
  const show =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/no-access" ||
    pathname.startsWith("/login");

  if (!show) return null;

  return (
    <footer className="mt-auto border-t border-brand/10 bg-white/90 backdrop-blur-sm" role="contentinfo">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="h-1 w-full max-w-xs rounded-full bg-gradient-to-r from-brand via-brand-hover to-brand-deep" aria-hidden />
        <div className="mt-6 space-y-3 text-center sm:text-left">
          <p className="font-heading text-sm font-bold uppercase tracking-wide brand-gradient-text">
            Inventory Tracker
          </p>
          <p className="text-sm leading-relaxed text-black/70">
            Designed by{" "}
            <span className="font-semibold text-black">
              Mogamat Shafiek Christian
            </span>{" "}
            for{" "}
            <span className="font-semibold text-brand">Handicaps Network Africa</span>
            .
          </p>
          <p className="text-xs leading-relaxed text-black/50">
            © 2026 Digital Fingers Pty Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
