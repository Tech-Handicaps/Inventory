import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { displayNameFromUser } from "@/lib/auth/display-name";
import { buildHandicaperWelcome } from "@/lib/handicaper/welcome";
import {
  buildWelcomeSpeechText,
  synthesizeWelcomeSpeechMp3,
} from "@/lib/handicaper/welcome-speech";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/ai/handicaper/welcome-speech — narrative welcome MP3 (OpenAI TTS) */
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: { displayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim()
      : displayNameFromUser(auth.user);

  const welcome = buildHandicaperWelcome(displayName);
  const text = buildWelcomeSpeechText(welcome);
  const mp3 = await synthesizeWelcomeSpeechMp3(text);

  if (!mp3) {
    return NextResponse.json(
      {
        error:
          "Welcome voice unavailable. Check OPENAI_API_KEY or try browser voice.",
      },
      { status: 503 }
    );
  }

  return new NextResponse(new Uint8Array(mp3), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Handicaper-Voice":
        process.env.HANDICAPER_WELCOME_VOICE?.trim() || "ballad",
    },
  });
}
