"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HandicaperWelcome } from "@/lib/handicaper/welcome";
import {
  cancelHandicaperSpeech,
  isHandicaperVoiceMuted,
  isSpeechSupported,
  isWelcomeVoiceEnabled,
  playWelcomeChime,
  setHandicaperVoiceMuted,
  speakWelcome,
} from "@/lib/handicaper/voice";

type Props = {
  welcome: HandicaperWelcome;
  onDismiss: (e: React.MouseEvent) => void;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useTypewriter(text: string, active: boolean, msPerChar = 26): string {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(reduced ? text : "");

  useEffect(() => {
    if (reduced || !active) {
      setOut(text);
      return;
    }
    setOut("");
    let i = 0;
    const tick = () => {
      i += 1;
      setOut(text.slice(0, i));
      if (i < text.length) {
        timer = window.setTimeout(tick, msPerChar);
      }
    };
    let timer = window.setTimeout(tick, msPerChar);
    return () => window.clearTimeout(timer);
  }, [text, active, reduced, msPerChar]);

  return out;
}

export function MascotWelcomeBubble({ welcome, onDismiss }: Props) {
  const reduced = usePrefersReducedMotion();
  const voiceEnabled = isWelcomeVoiceEnabled();
  const speechOk = voiceEnabled && isSpeechSupported();
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return true;
    return !voiceEnabled || isHandicaperVoiceMuted();
  });
  const [speaking, setSpeaking] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  const fullIntro = useMemo(
    () => `${welcome.intro} ${welcome.prompt}`,
    [welcome.intro, welcome.prompt]
  );

  const typedIntro = useTypewriter(fullIntro, true, 22);
  const introDone = typedIntro.length >= fullIntro.length;

  const [showExtras, setShowExtras] = useState(reduced);

  const runVoice = useCallback(async () => {
    if (!voiceEnabled || !speechOk || isHandicaperVoiceMuted()) return;
    setSpeaking(true);
    setNeedsTap(false);
    playWelcomeChime();
    try {
      const ok = await speakWelcome(welcome);
      setSpeaking(false);
      if (!ok) setNeedsTap(true);
    } catch {
      setSpeaking(false);
      setNeedsTap(true);
    }
  }, [voiceEnabled, speechOk, welcome]);

  useEffect(() => {
    if (!voiceEnabled || muted || !speechOk) return;
    const t = window.setTimeout(() => {
      void runVoice();
    }, 450);
    return () => {
      window.clearTimeout(t);
      cancelHandicaperSpeech();
      setSpeaking(false);
    };
  }, [voiceEnabled, muted, speechOk, runVoice]);

  useEffect(() => {
    if (reduced) {
      setShowExtras(true);
      return;
    }
    if (!introDone) {
      setShowExtras(false);
      return;
    }
    const t = window.setTimeout(() => setShowExtras(true), 200);
    return () => window.clearTimeout(t);
  }, [introDone, reduced]);

  const toggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const next = !muted;
      setMuted(next);
      setHandicaperVoiceMuted(next);
      if (next) {
        cancelHandicaperSpeech();
        setSpeaking(false);
        setNeedsTap(false);
      } else {
        void runVoice();
      }
    },
    [muted, runVoice]
  );

  const handleListen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setHandicaperVoiceMuted(false);
      setMuted(false);
      void runVoice();
    },
    [runVoice]
  );

  const showSpeakDots = speaking || (!introDone && !reduced);

  return (
    <div className="mascot-bubble mascot-bubble-welcome absolute -top-[17.5rem] right-0 w-[19rem] rounded-2xl border border-black/10 bg-white px-4 py-3.5 shadow-xl sm:w-[21rem]">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white hover:bg-black"
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-xs font-black text-brand">
          H
        </span>
        <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-black/45">
          Handicaper
        </span>
        {speechOk ? (
          <button
            type="button"
            onClick={toggleMute}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-black/40 transition hover:bg-black/5 hover:text-brand"
            aria-label={muted ? "Unmute Handicaper voice" : "Mute Handicaper voice"}
            title={muted ? "Unmute welcome voice" : "Mute welcome voice"}
          >
            {muted ? (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M9 9a3 3 0 000 6M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        ) : null}
        {showSpeakDots ? (
          <span
            className={`mascot-speak-dots flex gap-0.5 ${speechOk ? "" : "ml-auto"}`}
            aria-hidden
          >
            <span className="mascot-speak-dot" />
            <span className="mascot-speak-dot" />
            <span className="mascot-speak-dot" />
          </span>
        ) : null}
      </div>

      <p className="font-heading text-sm font-bold text-black">{welcome.greeting}</p>

      <p className="mt-1.5 min-h-[4.5rem] text-xs leading-relaxed text-black/75">
        {typedIntro}
        {!introDone && !reduced ? (
          <span className="mascot-type-cursor ml-0.5 inline-block h-3 w-0.5 bg-brand align-middle" />
        ) : null}
      </p>

      {needsTap && speechOk && !muted ? (
        <button
          type="button"
          onClick={handleListen}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand/25 bg-brand/5 py-1.5 text-[11px] font-semibold text-brand transition hover:bg-brand/10"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          Play welcome voice
        </button>
      ) : null}

      <div
        className={`mt-2 space-y-2 transition-all duration-500 ${
          showExtras ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-1"
        }`}
      >
        <ul className="space-y-1.5 border-t border-black/8 pt-2">
          {welcome.capabilities.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-[11px] leading-snug text-black/65"
            >
              <span className="mt-0.5 text-brand" aria-hidden>
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] font-medium text-brand/80">{welcome.cta}</p>
      </div>

      <div className="absolute -bottom-2 right-10 h-3 w-3 rotate-45 border-b border-r border-black/10 bg-white" />
    </div>
  );
}
