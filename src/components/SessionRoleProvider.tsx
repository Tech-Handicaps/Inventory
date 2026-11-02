"use client";

import { Suspense, use } from "react";
import { usePathname } from "next/navigation";
import { RoleProvider } from "@/components/RoleProvider";
import type { SessionWithRole } from "@/lib/auth/get-session-role";

type SessionPromise = Promise<Pick<SessionWithRole, "role" | "email" | "displayName"> | null>;

function Resolved({ session, children }: { session: SessionPromise; children: React.ReactNode }) {
  const s = use(session);
  return (
    <RoleProvider initialRole={s?.role ?? null} initialEmail={s?.email ?? null} initialDisplayName={s?.displayName ?? null}>
      {children}
    </RoleProvider>
  );
}

/** App frame shown while the session check finishes, so the page never starts blank. */
function ShellPlaceholder() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return <div className="flex-1" />;
  return (
    <div className="flex min-h-screen flex-1" role="status" aria-label="Loading">
      <div className="hidden w-60 shrink-0 bg-[#20282d] lg:block" />
      <div className="flex-1">
        <div className="h-16 border-b border-line bg-white" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * The root layout passes the session as a promise instead of awaiting it, so the
 * document head, styles and scripts stream while the auth check runs.
 */
export function SessionRoleProvider({ session, children }: { session: SessionPromise; children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellPlaceholder />}>
      <Resolved session={session}>{children}</Resolved>
    </Suspense>
  );
}
