"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

type RoleState = {
  role: AppRole | null;
  loading: boolean;
  /** True when /api/me failed (network/server), not merely "no role". */
  loadError: boolean;
  refresh: () => void;
};

const RoleContext = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    void fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 403) {
          setRole(null);
          setLoadError(false);
          return;
        }
        if (!r.ok) {
          setRole(null);
          setLoadError(true);
          return;
        }
        const j = (await r.json()) as { role?: AppRole };
        setRole(j.role ?? null);
      })
      .catch(() => {
        setRole(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch (e) {
      console.error("RoleProvider: supabase client", e);
      const t = window.setTimeout(() => {
        if (cancelled) return;
        setRole(null);
        setLoadError(true);
        setLoading(false);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    void supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (cancelled) return;
      if (error || !user) {
        setRole(null);
        setLoading(false);
        return;
      }
      void load();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setRole(null);
        setLoadError(false);
        setLoading(false);
        return;
      }
      void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [load]);

  const value = useMemo(
    () => ({ role, loading, loadError, refresh: load }),
    [role, loading, loadError, load]
  );

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  );
}

export function useAppRole(): RoleState {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      role: null,
      loading: false,
      loadError: false,
      refresh: () => {},
    };
  }
  return ctx;
}
