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

const OPEN_KEY = "hna.handicaper.open";

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
  const restoredRef = useRef(false);

  const setPanelOpen = useCallback((next: boolean) => {
    try {
      window.sessionStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* sessionStorage unavailable */
    }
    setOpen(next);
  }, []);

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
    setPanelOpen(true);
  }, [pathname, setPanelOpen]);

  useEffect(() => {
    let wasOpen = false;
    try {
      wasOpen = window.sessionStorage.getItem(OPEN_KEY) === "1";
    } catch {
      /* sessionStorage unavailable */
    }
    if (!wasOpen) {
      restoredRef.current = true;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      restoredRef.current = true;
      setRequest({ mode: "chat", page: pageFromPath(window.location.pathname) });
      setOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const close = useCallback(() => setPanelOpen(false), [setPanelOpen]);

  const toggle = useCallback(() => {
    if (open) {
      setPanelOpen(false);
    } else {
      openChat();
    }
  }, [open, openChat, setPanelOpen]);

  const openMetric = useCallback(
    (metricKey: string, metricLabel: string) => {
      setRequest({
        mode: "metric",
        metricKey,
        metricLabel,
        page: pageFromPath(pathname),
      });
      setPanelOpen(true);
    },
    [pathname, setPanelOpen]
  );

  const value = useMemo(
    () => ({ displayName, openChat, openMetric }),
    [displayName, openChat, openMetric]
  );

  return (
    <HandicaperContext.Provider value={value}>
      {children}
      <HandicaperMascot open={open} onToggle={toggle} />
      <HandicaperModal
        open={open}
        request={request}
        displayName={displayName}
        onClose={close}
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
