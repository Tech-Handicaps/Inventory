"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MascotWelcomeBubble } from "@/components/MascotWelcomeBubble";
import {
  buildHandicaperWelcome,
  buildMascotShortGreeting,
} from "@/lib/handicaper/welcome";
import { cancelHandicaperSpeech } from "@/lib/handicaper/voice";

type Props = {
  displayName?: string | null;
  onOpenChat: () => void;
};

const IDLE_PROMPTS = [
  "Still here? Ask me about stock, clubs, or exports!",
  "Need a stock breakdown or CSV? Tap me.",
  "I can explain dashboard metrics — just click.",
  "Try: asset movement for a golf club by name.",
];

function pageLabel(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/inventory")) return "Hardware board";
  if (pathname.startsWith("/assets")) return "All assets";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Inventory";
}

type Phase = "strolling" | "idle" | "dismissed";
type BubbleMode = "welcome" | "hint" | null;

const SPRITE_FRAMES = 4;
const SPRITE_NATURAL_W = 1536;
const SPRITE_NATURAL_H = 1024;
const FRAME_NATURAL_W = SPRITE_NATURAL_W / SPRITE_FRAMES;
const DISPLAY_H = 170;
const DISPLAY_W = Math.round((FRAME_NATURAL_W / SPRITE_NATURAL_H) * DISPLAY_H);
const STROLL_DURATION = 9000;
const WALK_FRAME_MS = 160;
const IDLE_FRAME = 1;
const WELCOME_BUBBLE_MS = 22000;

export function HandicaperMascot({ displayName, onOpenChat }: Props) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("strolling");
  const [bubbleMode, setBubbleMode] = useState<BubbleMode>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [frame, setFrame] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasWelcomed = useRef(false);

  const welcome = useMemo(
    () => buildHandicaperWelcome(displayName),
    [displayName]
  );

  const hideBubble = useCallback(() => {
    cancelHandicaperSpeech();
    setBubbleVisible(false);
    setBubbleMode(null);
    setHintText(null);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  const showWelcome = useCallback(() => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    setBubbleMode("welcome");
    setHintText(null);
    setBubbleVisible(true);
    bubbleTimer.current = setTimeout(() => {
      setBubbleVisible(false);
      setBubbleMode(null);
    }, WELCOME_BUBBLE_MS);
  }, []);

  const showHint = useCallback((text: string, duration = 8000) => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    setBubbleMode("hint");
    setHintText(text);
    setBubbleVisible(true);
    bubbleTimer.current = setTimeout(() => {
      setBubbleVisible(false);
      setBubbleMode(null);
      setHintText(null);
    }, duration);
  }, []);

  useEffect(() => {
    if (phase !== "strolling") return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % SPRITE_FRAMES);
    }, WALK_FRAME_MS);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "strolling") return;
    const t = setTimeout(() => {
      setFrame(IDLE_FRAME);
      setPhase("idle");
      if (!hasWelcomed.current) {
        hasWelcomed.current = true;
        showWelcome();
      }
    }, STROLL_DURATION);
    return () => clearTimeout(t);
  }, [phase, showWelcome]);

  useEffect(() => {
    if (phase !== "idle") return;
    idleTimer.current = setTimeout(() => {
      if (bubbleVisible && bubbleMode === "welcome") return;
      const prompt =
        IDLE_PROMPTS[Math.floor(Math.random() * IDLE_PROMPTS.length)] ??
        buildMascotShortGreeting(displayName, pageLabel(pathname));
      showHint(prompt, 8000);
    }, 60000);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [
    phase,
    bubbleVisible,
    bubbleMode,
    showHint,
    displayName,
    pathname,
  ]);

  useEffect(
    () => () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    },
    []
  );

  const handleClick = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    hideBubble();
    onOpenChat();
  }, [hideBubble, onOpenChat]);

  const dismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      hideBubble();
    },
    [hideBubble]
  );

  if (phase === "dismissed") return null;

  const activeFrame = phase === "idle" ? IDLE_FRAME : frame;

  return (
    <div
      className={`fixed bottom-4 z-40 ${phase === "strolling" ? "mascot-stroll" : ""}`}
      style={phase === "idle" ? { right: 32 } : undefined}
    >
      {bubbleVisible && phase === "idle" && bubbleMode === "welcome" ? (
        <MascotWelcomeBubble welcome={welcome} onDismiss={dismiss} />
      ) : null}

      {bubbleVisible && phase === "idle" && bubbleMode === "hint" && hintText ? (
        <div className="mascot-bubble absolute -top-24 right-0 w-72 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-xl">
          <button
            type="button"
            onClick={dismiss}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white hover:bg-black"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <p className="text-xs leading-relaxed text-black/80">{hintText}</p>
          <div className="absolute -bottom-2 right-8 h-3 w-3 rotate-45 border-b border-r border-black/10 bg-white" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        className={`group relative cursor-pointer bg-transparent p-0 transition active:scale-95 ${
          phase === "idle" ? "hover:scale-105" : ""
        }`}
        title="Click to talk to Handicaper"
        aria-label="Open Handicaper assistant"
      >
        <div
          className={phase === "strolling" ? "mascot-walk-bob" : "mascot-bob"}
          style={{
            width: DISPLAY_W,
            height: DISPLAY_H,
            backgroundImage: "url(/brand/handicaper-walk-sprite.png)",
            backgroundRepeat: "no-repeat",
            backgroundSize: `${DISPLAY_W * SPRITE_FRAMES}px ${DISPLAY_H}px`,
            backgroundPosition: `-${activeFrame * DISPLAY_W}px 0`,
            filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.12))",
          }}
          role="img"
          aria-label="Handicaper mascot"
        />

        {phase === "idle" && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/40" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-brand" />
          </span>
        )}
      </button>
    </div>
  );
}
