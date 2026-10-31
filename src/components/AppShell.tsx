"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Menu,
  Package,
  FileText,
  Plus,
  Settings,
  SquareKanban,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { GlobalSearch } from "@/components/GlobalSearch";
import { HandicaperProvider } from "@/components/HandicaperProvider";
import { useAppRole } from "@/components/RoleProvider";
import { useToast } from "@/components/ToastProvider";
import { isNavLinkVisible, hasFullNavAccess, type NavKey } from "@/lib/auth/nav-access";
import { ADD_HARDWARE_EVENT, ADD_HARDWARE_HREF } from "@/lib/client/add-hardware";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter } from "next/navigation";

export type AppShellCurrent = NavKey;

function navKeyFromPath(pathname: string): AppShellCurrent | undefined {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/assets")) return "assets";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/settings")) return "settings";
  return undefined;
}

const NAV_ITEMS: {
  href: string;
  key: NavKey;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: "/inventory", key: "inventory", label: "Hardware board", icon: SquareKanban },
  { href: "/dashboard", key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", key: "assets", label: "All assets", icon: Package },
  { href: "/reports", key: "reports", label: "Reports", icon: FileText },
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
    if (hasFullNavAccess(role)) return true;
    if (loading || loadError || role === null) {
      return key !== "settings";
    }
    return isNavLinkVisible(role, key);
  };

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        if (!visible(item.key)) return null;
        const active = current === item.key;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`nav-link ${active ? "nav-link-active" : "nav-link-inactive"}`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
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
    <div className="border-t border-white/10 px-4 py-4">
      {loadError ? (
        <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          Could not load role — refresh or sign in again
        </p>
      ) : null}
      <p className="truncate text-xs font-medium text-white/75" title={email ?? undefined}>
        {email ?? "Signed in"}
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-2 text-sm font-medium text-white hover:underline"
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
  return (
    <div className="sidebar-shell flex h-full flex-col">
      <div className="px-5 pb-4 pt-6">
        <Link href="/inventory" onClick={onNavigate} className="block w-40" title="Hardware board (home)">
          <BrandLogo onDark className="h-auto w-40" priority />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNav current={current} onNavigate={onNavigate} />
      </div>
      <SidebarUser onNavigate={onNavigate} />
    </div>
  );
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { role } = useAppRole();
  const pathname = usePathname();
  const canUseAssets = role !== "reports_only";

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white px-4 py-3 lg:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-lg border border-line p-2 text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{canUseAssets ? <GlobalSearch /> : null}</div>
      {canUseAssets ? (
        <Link
          href={ADD_HARDWARE_HREF}
          className="btn-primary shrink-0"
          aria-label="Add hardware"
          onClick={(e) => {
            if (!pathname.startsWith("/inventory")) return;
            e.preventDefault();
            window.dispatchEvent(new Event(ADD_HARDWARE_EVENT));
          }}
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">Add hardware</span>
        </Link>
      ) : null}
    </header>
  );
}

/**
 * App chrome: charcoal sidebar (desktop) or drawer (mobile), plus the top bar.
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
    <HandicaperProvider>
      <div className="min-h-screen lg:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
          <SidebarPanel current={current} />
        </aside>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal aria-label="Menu">
            <button
              type="button"
              className="modal-overlay absolute inset-0"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[min(100%,18rem)] flex-col">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 z-10 rounded-lg p-2 text-white/80 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              <SidebarPanel current={current} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMenu={() => setOpen(true)} />
          <div className="app-canvas min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </HandicaperProvider>
  );
}
