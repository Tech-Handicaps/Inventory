"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

const SPLASH_KEY = "hna-splash-seen";
/** Brand pulse duration for first visit in a session (~2s). */
const SPLASH_MS = 2000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasSeenSplash(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === "1";
  } catch {
    return true;
  }
}

function markSplashSeen(): void {
  try {
    sessionStorage.setItem(SPLASH_KEY, "1");
  } catch {
    /* ignore */
  }
}

type Props = {
  children: React.ReactNode;
};

type Phase = "checking" | "splash" | "done";

/**
 * Once per browser session: brand pulse + loader, then children.
 * Returning visitors skip without a splash flash. Pulse respects reduced-motion CSS.
 */
export function BrandSplashGate({ children }: Props) {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const start = window.setTimeout(() => {
      if (cancelled) return;
      if (hasSeenSplash()) {
        setPhase("done");
        return;
      }
      setPhase("splash");
      const ms = prefersReducedMotion() ? 400 : SPLASH_MS;
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        markSplashSeen();
        setPhase("done");
      }, ms);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (phase === "checking") {
    return (
      <div className="min-h-screen bg-surface" aria-hidden>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (phase === "splash") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-surface px-6">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(19,157,75,0.18),transparent_55%)]"
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-8">
          <div className="origin-center animate-brand-heartbeat">
            <BrandLogo className="h-24 w-auto sm:h-28" priority />
          </div>
          <div className="flex flex-col items-center gap-3" aria-live="polite">
            <div
              className="h-1 w-40 overflow-hidden rounded-full bg-black/10"
              role="progressbar"
              aria-label="Loading"
            >
              <div className="h-full w-1/3 animate-brand-loader rounded-full bg-brand" />
            </div>
            <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">
              Handicaps Network Africa
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
