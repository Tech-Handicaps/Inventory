"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  HandicaperModal,
  type HandicaperRequest,
} from "@/components/HandicaperModal";
import { HandicaperMascot } from "@/components/HandicaperMascot";

type HandicaperContextValue = {
  displayName: string | null;
  openChat: () => void;
  openMetric: (metricKey: string, metricLabel: string) => void;
};

const HandicaperContext = createContext<HandicaperContextValue | null>(null);

function pageFromPath(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/inventory")) return "inventory";
  if (pathname.startsWith("/assets")) return "assets";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/settings")) return "settings";
  return "app";
}

export function HandicaperProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<HandicaperRequest | null>(null);

  useEffect(() => {
    void fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as { displayName?: string };
      })
      .then((j) => {
        if (j?.displayName) setDisplayName(j.displayName);
      })
      .catch(() => {});
  }, []);

  const openChat = useCallback(() => {
    setRequest({
      mode: "chat",
      page: pageFromPath(pathname),
    });
    setOpen(true);
  }, [pathname]);

  const openMetric = useCallback(
    (metricKey: string, metricLabel: string) => {
      setRequest({
        mode: "metric",
        metricKey,
        metricLabel,
        page: pageFromPath(pathname),
      });
      setOpen(true);
    },
    [pathname]
  );

  const value = useMemo(
    () => ({ displayName, openChat, openMetric }),
    [displayName, openChat, openMetric]
  );

  return (
    <HandicaperContext.Provider value={value}>
      {children}
      <HandicaperMascot displayName={displayName} onOpenChat={openChat} />
      <HandicaperModal
        open={open}
        request={request}
        displayName={displayName}
        onClose={() => setOpen(false)}
      />
    </HandicaperContext.Provider>
  );
}

export function useHandicaper(): HandicaperContextValue {
  const ctx = useContext(HandicaperContext);
  if (!ctx) {
    return {
      displayName: null,
      openChat: () => {},
      openMetric: () => {},
    };
  }
  return ctx;
}
