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
  refresh: () => void;
};

const RoleContext = createContext<RoleState | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { role?: AppRole } | null) => {
        setRole(j?.role ?? null);
      })
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (!session?.user) {
        setRole(null);
        setLoading(false);
      } else {
        void load();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setRole(null);
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
    () => ({ role, loading, refresh: load }),
    [role, loading, load]
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
      refresh: () => {},
    };
  }
  return ctx;
}
