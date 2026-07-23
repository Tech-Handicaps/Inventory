"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Package,
  FileText,
  Settings,
  Home,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAppRole } from "@/components/RoleProvider";
import { useToast } from "@/components/ToastProvider";
import { isNavLinkVisible, type NavKey } from "@/lib/auth/nav-access";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";

export type AppShellCurrent = NavKey;

function navKeyFromPath(pathname: string): AppShellCurrent | undefined {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/assets")) return "assets";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/acknowledgements")) return "acknowledgements";
  if (pathname.startsWith("/settings")) return "settings";
  return undefined;
}

const NAV_ITEMS: {
  href: string;
  key: NavKey;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: "/", key: "home", label: "Home", icon: Home },
  {
    href: "/dashboard",
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/inventory",
    key: "inventory",
    label: "Hardware board",
    icon: LayoutGrid,
  },
  { href: "/assets", key: "assets", label: "All assets", icon: Package },
  { href: "/reports", key: "reports", label: "Reports", icon: FileText },
  {
    href: "/acknowledgements",
    key: "acknowledgements",
    label: "Acknowledgements",
    icon: ClipboardCheck,
  },
  { href: "/settings", key: "settings", label: "Settings", icon: Settings },
];

type Props = {
  children: React.ReactNode;
};

function SidebarNav({
  current,
  onNavigate,
}: {
  current?: AppShellCurrent;
  onNavigate?: () => void;
}) {
  const { role, loading, loadError } = useAppRole();

  const visible = (key: NavKey) => {
    // Fail closed: hide privileged links until role is known.
    if (loading) return key === "home";
    if (loadError || role === null) return key === "home";
    return isNavLinkVisible(role, key);
  };

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        if (!visible(item.key)) return null;
        const active = current === item.key;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            className={`font-heading group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
              active
                ? "bg-brand-muted text-brand-hover"
                : "text-black/65 hover:bg-black/[0.04] hover:text-black"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                active
                  ? "bg-brand text-white"
                  : "bg-black/[0.04] text-black/55 group-hover:text-brand"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="truncate">{item.label}</span>
            {active ? (
              <span
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                aria-hidden
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarUser({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { loadError } = useAppRole();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createClient();
      void supabase.auth
        .getUser()
        .then(({ data: { user }, error }) => {
          if (cancelled) return;
          if (error) {
            setEmail(null);
            return;
          }
          setEmail(user?.email ?? null);
        })
        .catch(() => {
          if (!cancelled) setEmail(null);
        });
    } catch {
      /* missing env */
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.showError(error.message || "Sign out failed");
        return;
      }
      onNavigate?.();
      router.push("/login");
      router.refresh();
    } catch {
      toast.showError("Sign out failed");
    }
  }

  return (
    <div className="border-t border-black/10 px-4 py-4">
      {loadError ? (
        <p className="mb-2 text-[11px] text-amber-800">
          Could not load role — refresh or sign in again
        </p>
      ) : null}
      {email ? (
        <p className="truncate text-xs text-black/55" title={email}>
          {email}
        </p>
      ) : (
        <p className="text-xs text-black/40">Signed in</p>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        className="font-heading mt-2 text-xs font-bold uppercase tracking-wide text-brand hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

function SidebarPanel({
  current,
  onNavigate,
}: {
  current?: AppShellCurrent;
  onNavigate?: () => void;
}) {
  const { role, loading } = useAppRole();
  const subtitle =
    role === "reports_only" && !loading
      ? "PDF reports and downloads"
      : "Stock · repairs · refurbishment";

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-black/8 px-4 py-5">
        <Link href="/inventory" onClick={onNavigate} className="block">
          <BrandLogo className="h-9 w-auto" priority={current === "inventory"} />
        </Link>
        <p className="font-heading mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-black">
          Hardware inventory
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-black/50">
          {subtitle}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNav current={current} onNavigate={onNavigate} />
      </div>
      <SidebarUser onNavigate={onNavigate} />
    </div>
  );
}

/**
 * App chrome: icon sidebar (desktop) + drawer (mobile). Active item from pathname.
 */
export function AppShell({ children }: Props) {
  const pathname = usePathname();
  const current = navKeyFromPath(pathname);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen bg-surface lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-black/10 lg:block">
        <SidebarPanel current={current} />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col shadow-xl">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-white/90 p-2 text-black/70 shadow-sm"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarPanel
              current={current}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-black/10 p-2 text-black/70"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-heading truncate text-[10px] font-bold uppercase tracking-[0.16em] text-black">
              Hardware inventory
            </p>
          </div>
          <BrandLogo className="h-7 w-auto" />
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
