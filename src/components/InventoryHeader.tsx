import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { BrandLogo } from "@/components/BrandLogo";

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

export function InventoryHeader({ current }: Props) {
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
              Track stock, repairs, and refurbishment
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-3 sm:items-end">
        <nav
          className="font-heading flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold uppercase tracking-wide sm:justify-end"
          aria-label="Main"
        >
          <Link href="/" className={current === "home" ? active : link}>
            Home
          </Link>
          <Link
            href="/dashboard"
            className={current === "dashboard" ? active : link}
          >
            Dashboard
          </Link>
          <Link
            href="/inventory"
            className={current === "inventory" ? active : link}
          >
            Hardware board
          </Link>
          <Link href="/assets" className={current === "assets" ? active : link}>
            All assets
          </Link>
          <Link
            href="/reports"
            className={current === "reports" ? active : link}
          >
            Reports
          </Link>
          <Link
            href="/settings"
            className={current === "settings" ? active : link}
          >
            Settings
          </Link>
        </nav>
        <AuthNav />
        </div>
      </div>
    </header>
  );
}
