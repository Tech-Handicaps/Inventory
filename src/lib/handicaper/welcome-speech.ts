import type { HandicaperWelcome } from "@/lib/handicaper/welcome";

/** Warm, narrative script for TTS — Handicaper the friendly course guide. */
export function buildWelcomeSpeechText(welcome: HandicaperWelcome): string {
  const who = welcome.greeting.replace(/^Hey\s+|\!$/g, "").trim() || "friend";
  return [
    `Hey ${who}!`,
    "Welcome to the Handicaps Network Africa Inventory system.",
    "I'm Handicaper — your friendly guide around the course of hardware and stock.",
    "So… what would you like to achieve today?",
    "I can walk you through stock levels and model breakdowns,",
    "club asset movement and timelines,",
    "dashboard metrics,",
    "or a full export of the asset registry.",
    "Just click me when you're ready — and ask in plain English.",
  ].join(" ");
}

export const HANDICAPER_WELCOME_TTS_MODEL =
  process.env.HANDICAPER_WELCOME_TTS_MODEL?.trim() || "tts-1-hd";

export type HandicaperTtsVoice =
  | "alloy"
  | "ash"
  | "ballad"
  | "coral"
  | "echo"
  | "fable"
  | "nova"
  | "onyx"
  | "sage"
  | "shimmer"
  | "verse";

/** Expressive, story-like voice — override with HANDICAPER_WELCOME_VOICE in .env */
export function handicaperWelcomeVoice(): HandicaperTtsVoice {
  const v = process.env.HANDICAPER_WELCOME_VOICE?.trim().toLowerCase();
  const allowed: HandicaperTtsVoice[] = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
  ];
  if (v && allowed.includes(v as HandicaperTtsVoice)) {
    return v as HandicaperTtsVoice;
  }
  /** `ballad` — warm, melodic narrative tone (OpenAI TTS HD). Try `coral` or `shimmer` for sweeter. */
  return "ballad";
}

export async function synthesizeWelcomeSpeechMp3(
  text: string
): Promise<Buffer | null> {
  /** Skip OpenAI when forced to browser or when key missing (avoids quota burns). */
  const mode = process.env.HANDICAPER_WELCOME_TTS?.trim().toLowerCase();
  if (mode === "browser" || mode === "off") return null;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: openaiKey });
    const response = await client.audio.speech.create({
      model: HANDICAPER_WELCOME_TTS_MODEL,
      voice: handicaperWelcomeVoice(),
      input: text,
      speed: 0.92,
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (e) {
    console.warn("Handicaper welcome TTS failed", e);
    return null;
  }
}
