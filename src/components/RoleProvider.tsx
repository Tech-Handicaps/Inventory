"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

type RoleState = {
  role: AppRole | null;
  email: string | null;
  displayName: string | null;
  loading: boolean;
  /** True when /api/me failed (network/server), not merely "no role". */
  loadError: boolean;
  refresh: () => void;
};

const RoleContext = createContext<RoleState | null>(null);

type MeResponse = { role?: AppRole; email?: string | null; displayName?: string };

/**
 * Session role for the UI. The root layout resolves it on the server, so normal page loads
 * make no extra request; /api/me is only called when the auth state actually changes.
 */
export function RoleProvider({
  children,
  initialRole = null,
  initialEmail = null,
  initialDisplayName = null,
}: {
  children: React.ReactNode;
  /** Resolved on the server (incl. protected admin / super_admin allowlists). */
  initialRole?: AppRole | null;
  initialEmail?: string | null;
  initialDisplayName?: string | null;
}) {
  const [role, setRole] = useState<AppRole | null>(initialRole);
  const [email, setEmail] = useState<string | null>(initialEmail);
  const [displayName, setDisplayName] = useState<string | null>(initialDisplayName);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Server re-renders (e.g. router.refresh() after sign-in) pass fresh values.
  const [seen, setSeen] = useState({ initialRole, initialEmail, initialDisplayName });
  if (
    seen.initialRole !== initialRole ||
    seen.initialEmail !== initialEmail ||
    seen.initialDisplayName !== initialDisplayName
  ) {
    setSeen({ initialRole, initialEmail, initialDisplayName });
    setRole(initialRole);
    setEmail(initialEmail);
    setDisplayName(initialDisplayName);
  }

  const emailRef = useRef(email);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);

  const load = useCallback((options?: { background?: boolean }) => {
    if (!options?.background) setLoading(true);
    setLoadError(false);
    void fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          setRole(null);
          return;
        }
        if (!r.ok) {
          setLoadError(true);
          return;
        }
        const j = (await r.json()) as MeResponse;
        setRole(j.role ?? null);
        setEmail(j.email ?? null);
        setDisplayName(j.displayName ?? null);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch (e) {
      console.error("RoleProvider: supabase client", e);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setRole(null);
        setEmail(null);
        setDisplayName(null);
        setLoadError(false);
        return;
      }
      // Supabase also emits SIGNED_IN when it restores the session on page load.
      if (
        event === "USER_UPDATED" ||
        (event === "SIGNED_IN" && session.user.email?.toLowerCase() !== emailRef.current?.toLowerCase())
      ) {
        void load({ background: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const value = useMemo(
    () => ({ role, email, displayName, loading, loadError, refresh: () => load() }),
    [role, email, displayName, loading, loadError, load]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useAppRole(): RoleState {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      role: null,
      email: null,
      displayName: null,
      loading: false,
      loadError: false,
      refresh: () => {},
    };
  }
  return ctx;
}
