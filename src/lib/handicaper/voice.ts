import type { HandicaperWelcome } from "@/lib/handicaper/welcome";
import { buildWelcomeSpeechText } from "@/lib/handicaper/welcome-speech";

const VOICE_MUTED_KEY = "hna-handicaper-voice-muted";
const OPENAI_TTS_SKIP_KEY = "hna-handicaper-skip-openai-tts";

/**
 * Master switch — set NEXT_PUBLIC_HANDICAPER_WELCOME_VOICE=off in .env to silence welcome audio.
 * Restart `npm run dev` after changing. Set to `on` (or remove) to re-enable later.
 */
export function isWelcomeVoiceEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_HANDICAPER_WELCOME_VOICE?.trim().toLowerCase();
  if (
    flag === "off" ||
    flag === "0" ||
    flag === "false" ||
    flag === "no"
  ) {
    return false;
  }
  return true;
}

let activeWelcomeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
const welcomeAudioCache = new Map<string, string>();
let browserSpeakGeneration = 0;

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    (typeof Audio !== "undefined" || "speechSynthesis" in window)
  );
}

export function isHandicaperVoiceMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(VOICE_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHandicaperVoiceMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      window.localStorage.setItem(VOICE_MUTED_KEY, "1");
    } else {
      window.localStorage.removeItem(VOICE_MUTED_KEY);
    }
  } catch {
    /* ignore */
  }
}

function shouldSkipOpenAiTts(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(OPENAI_TTS_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

function markOpenAiTtsUnavailable(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(OPENAI_TTS_SKIP_KEY, "1");
  } catch {
    /* ignore */
  }
}

export { buildWelcomeSpeechText };

/** Soft chime when the welcome bubble appears (welcome only). */
export function playWelcomeChime(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.42);
    window.setTimeout(() => void ctx.close().catch(() => {}), 550);
  } catch {
    /* autoplay blocked */
  }
}

export function cancelHandicaperSpeech(): void {
  browserSpeakGeneration += 1;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (activeWelcomeAudio) {
    activeWelcomeAudio.pause();
    activeWelcomeAudio.src = "";
    activeWelcomeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function cacheKey(welcome: HandicaperWelcome): string {
  return welcome.greeting;
}

async function fetchWelcomeMp3(
  welcome: HandicaperWelcome
): Promise<string | null> {
  if (shouldSkipOpenAiTts()) return null;

  const key = cacheKey(welcome);
  const cached = welcomeAudioCache.get(key);
  if (cached) return cached;

  const who = welcome.greeting.replace(/^Hey\s+|\!$/g, "").trim();
  const res = await fetch("/api/ai/handicaper/welcome-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: who === "there" ? undefined : who }),
  });

  if (!res.ok) {
    markOpenAiTtsUnavailable();
    return null;
  }

  const blob = await res.blob();
  if (!blob.type.includes("audio") && blob.size < 500) {
    markOpenAiTtsUnavailable();
    return null;
  }

  const url = URL.createObjectURL(blob);
  welcomeAudioCache.set(key, url);
  return url;
}

function playAudioUrl(url: string): Promise<boolean> {
  cancelHandicaperSpeech();
  activeObjectUrl = url;

  return new Promise((resolve) => {
    const audio = new Audio(url);
    activeWelcomeAudio = audio;

    const finish = (ok: boolean) => {
      if (activeWelcomeAudio === audio) {
        activeWelcomeAudio = null;
      }
      resolve(ok);
    };

    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);

    void audio
      .play()
      .then(() => {})
      .catch(() => finish(false));
  });
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const finish = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 800);
  });
}

/**
 * Prefer warm / sweet / narrative system voices available on macOS, Windows, Chrome.
 * Higher score = better fit for Handicaper welcome.
 */
function scoreNarrativeVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();
  if (!lang.startsWith("en")) return -100;

  let score = 0;
  if (lang === "en-gb" || lang === "en-au" || lang === "en-za" || lang === "en-ie") {
    score += 8;
  }
  if (lang.startsWith("en-us")) score += 4;

  // Soft / sweet / story-like female voices (macOS + Windows + Chrome)
  const premium = [
    [/samantha/, 100],
    [/karen/, 95],
    [/moira/, 92],
    [/fiona/, 90],
    [/tessa/, 88],
    [/veena/, 85],
    [/aria/, 94],
    [/jenny/, 90],
    [/sara/, 86],
    [/zira/, 80],
    [/google uk english female/, 98],
    [/google us english/, 70],
    [/microsoft.*natural/, 75],
    [/enhanced/, 40],
    [/premium/, 45],
  ] as const;

  for (const [re, pts] of premium) {
    if (re.test(name)) score += pts;
  }

  // Prefer female / soft labels when present
  if (/female|woman|girl/.test(name)) score += 25;
  if (/male|man|boy|david|daniel|mark|george|fred|tom|alex/.test(name)) {
    score -= 40;
  }

  // Avoid robotic/default-sounding names slightly
  if (/compact|eloquence|novelty/.test(name)) score -= 30;

  return score;
}

function pickSweetNarrativeVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const ranked = [...voices].sort(
    (a, b) => scoreNarrativeVoice(b) - scoreNarrativeVoice(a)
  );
  const best = ranked[0];
  if (best && scoreNarrativeVoice(best) > 0) return best;
  return voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? voices[0];
}

/** Split welcome into short beats so browser TTS sounds more narrative. */
function welcomeSpeechBeats(welcome: HandicaperWelcome): string[] {
  const who = welcome.greeting.replace(/^Hey\s+|\!$/g, "").trim() || "friend";
  return [
    `Hey ${who}.`,
    "Welcome to the Handicaps Network Africa Inventory system.",
    "I'm Handicaper — your friendly guide around the course of hardware and stock.",
    "So… what would you like to achieve today?",
    "I can walk you through stock levels and model breakdowns,",
    "club asset movement and timelines,",
    "dashboard metrics,",
    "or a full export of the asset registry.",
    "Just click me when you're ready — and ask in plain English.",
  ];
}

function speakUtterance(
  text: string,
  voice: SpeechSynthesisVoice | undefined
): Promise<boolean> {
  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.88;
    utter.pitch = 1.08;
    utter.volume = 1;
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = "en-GB";
    }

    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    utter.onend = () => done(true);
    utter.onerror = () => done(false);

    try {
      window.speechSynthesis.speak(utter);
    } catch {
      done(false);
    }
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Browser narrative voice — no OpenAI quota required.
 * Uses the sweetest available system voice + paced short phrases.
 */
async function speakWelcomeBrowser(
  welcome: HandicaperWelcome
): Promise<boolean> {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;

  const generation = ++browserSpeakGeneration;
  window.speechSynthesis.cancel();

  const voices = await waitForVoices();
  if (generation !== browserSpeakGeneration) return false;

  const voice = pickSweetNarrativeVoice(voices);
  const beats = welcomeSpeechBeats(welcome);

  let anyOk = false;
  for (let i = 0; i < beats.length; i++) {
    if (generation !== browserSpeakGeneration) return false;
    const ok = await speakUtterance(beats[i]!, voice);
    if (!ok) return anyOk;
    anyOk = true;
    if (i < beats.length - 1) {
      await pause(i === 0 || i === 3 ? 320 : 180);
    }
  }

  return anyOk;
}

/**
 * Welcome voice:
 * 1) Prefer sweet browser narrative voice (works without OpenAI quota)
 * 2) Optionally try OpenAI HD TTS if not marked unavailable this session
 */
export async function speakWelcome(
  welcome: HandicaperWelcome
): Promise<boolean> {
  if (!isWelcomeVoiceEnabled() || isHandicaperVoiceMuted()) return false;

  // Browser path first — reliable without OpenAI TTS quota
  if (typeof window !== "undefined" && window.speechSynthesis) {
    const browserOk = await speakWelcomeBrowser(welcome);
    if (browserOk) return true;
  }

  // Optional premium OpenAI voice when quota is available
  try {
    const url = await fetchWelcomeMp3(welcome);
    if (url) {
      const ok = await playAudioUrl(url);
      if (ok) return true;
    }
  } catch {
    markOpenAiTtsUnavailable();
  }

  return false;
}

export function isHandicaperSpeaking(): boolean {
  if (activeWelcomeAudio && !activeWelcomeAudio.paused) return true;
  return (
    typeof window !== "undefined" && !!window.speechSynthesis?.speaking
  );
}
