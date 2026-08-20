"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
  displayName?: string | null;
  onOpenChat: () => void;
};

const IDLE_PROMPTS = [
  "Still here? Need any help with inventory?",
  "Hey — ask me about assets, stock, or reports!",
  "Tap me if you have a question about the system.",
  "I can explain metrics or answer inventory questions.",
];

function pageLabel(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "Dashboard";
  if (pathname.startsWith("/inventory")) return "Hardware board";
  if (pathname.startsWith("/assets")) return "All assets";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Inventory";
}

function buildGreeting(displayName: string | null | undefined, page: string): string {
  const who = displayName?.trim() || "there";
  const area = pageLabel(page);
  return `Hi ${who}! Welcome to the HNA Inventory system. I'm Handicaper — happy to help on ${area}. Click me to ask anything.`;
}

type Phase = "strolling" | "idle" | "dismissed";

const SPRITE_FRAMES = 4;
const SPRITE_NATURAL_W = 1536;
const SPRITE_NATURAL_H = 1024;
const FRAME_NATURAL_W = SPRITE_NATURAL_W / SPRITE_FRAMES;
const DISPLAY_H = 170;
const DISPLAY_W = Math.round((FRAME_NATURAL_W / SPRITE_NATURAL_H) * DISPLAY_H);
const STROLL_DURATION = 9000;
const WALK_FRAME_MS = 160;
const IDLE_FRAME = 1;

export function HandicaperMascot({ displayName, onOpenChat }: Props) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("strolling");
  const [bubble, setBubble] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [frame, setFrame] = useState(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasGreeted = useRef(false);

  const showBubble = useCallback((text: string, duration = 10000) => {
    setBubble(text);
    setBubbleVisible(true);
    setTimeout(() => setBubbleVisible(false), duration);
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
      if (!hasGreeted.current) {
        hasGreeted.current = true;
        showBubble(buildGreeting(displayName, pathname), 12000);
      }
    }, STROLL_DURATION);
    return () => clearTimeout(t);
  }, [phase, showBubble, displayName, pathname]);

  useEffect(() => {
    if (phase !== "idle") return;
    idleTimer.current = setTimeout(() => {
      const who = displayName?.trim() || "there";
      const prompt =
        IDLE_PROMPTS[Math.floor(Math.random() * IDLE_PROMPTS.length)] ??
        `Need help, ${who}?`;
      showBubble(prompt, 8000);
    }, 60000);
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [phase, bubbleVisible, showBubble, displayName]);

  const handleClick = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setBubbleVisible(false);
    onOpenChat();
  }, [onOpenChat]);

  const dismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setBubbleVisible(false);
    setPhase("dismissed");
  }, []);

  if (phase === "dismissed") return null;

  const activeFrame = phase === "idle" ? IDLE_FRAME : frame;

  return (
    <div
      className={`fixed bottom-4 z-40 ${phase === "strolling" ? "mascot-stroll" : ""}`}
      style={phase === "idle" ? { right: 32 } : undefined}
    >
      {bubble && bubbleVisible && phase === "idle" && (
        <div className="mascot-bubble absolute -top-24 right-0 w-72 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-xl">
          <button
            type="button"
            onClick={dismiss}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white hover:bg-black"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <p className="text-xs leading-relaxed text-black/80">{bubble}</p>
          <div className="absolute -bottom-2 right-8 h-3 w-3 rotate-45 border-b border-r border-black/10 bg-white" />
        </div>
      )}

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
