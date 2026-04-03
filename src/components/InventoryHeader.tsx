"use client";

import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { BrandLogo } from "@/components/BrandLogo";
import { useAppRole } from "@/components/RoleProvider";
import { isNavLinkVisible, type NavKey } from "@/lib/auth/nav-access";

const link = "text-black/70 transition-colors hover:text-brand";
const active =
  "font-semibold text-brand underline decoration-2 underline-offset-4";

type Props = {
  current?:
    | "home"
    | "dashboard"
    | "inventory"
    | "assets"
    | "reports"
    | "settings";
};

const NAV_ITEMS: { href: string; key: NavKey; label: string }[] = [
  { href: "/", key: "home", label: "Home" },
  { href: "/dashboard", key: "dashboard", label: "Dashboard" },
  { href: "/inventory", key: "inventory", label: "Hardware board" },
  { href: "/assets", key: "assets", label: "All assets" },
  { href: "/reports", key: "reports", label: "Reports" },
  { href: "/settings", key: "settings", label: "Settings" },
];

export function InventoryHeader({ current }: Props) {
  const { role, loading } = useAppRole();

  const visible = (key: NavKey) => {
    if (loading || role === null) return true;
    return isNavLinkVisible(role, key);
  };

  return (
    <header className="border-b-4 border-brand bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <BrandLogo priority={current === "inventory"} />
          <div className="hidden h-10 w-px bg-black/10 sm:block" aria-hidden />
          <div>
            <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-black">
              Hardware inventory
            </p>
            <p className="text-xs text-black/55">
              {role === "reports_only" && !loading
                ? "PDF reports and downloads"
                : "Track stock, repairs, and refurbishment"}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-3 sm:items-end">
        <nav
          className="font-heading flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold uppercase tracking-wide sm:justify-end"
          aria-label="Main"
        >
          {NAV_ITEMS.map((item) =>
            visible(item.key) ? (
              <Link
                key={item.key}
                href={item.href}
                className={current === item.key ? active : link}
              >
                {item.label}
              </Link>
            ) : null
          )}
        </nav>
        <AuthNav />
        </div>
      </div>
    </header>
  );
}
