import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { displayNameFromUser } from "@/lib/auth/display-name";
import { buildHandicaperInventoryContext } from "@/lib/ai/handicaper-context";
import {
  generateHandicaperChatReply,
  type ChatMessage,
} from "@/lib/ai/handicaper";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: {
    message?: string;
    page?: string;
    history?: ChatMessage[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const context = await buildHandicaperInventoryContext();
    const displayName = displayNameFromUser(auth.user);

    const reply = await generateHandicaperChatReply({
      message,
      page: typeof body.page === "string" ? body.page : undefined,
      history: Array.isArray(body.history) ? body.history : [],
      displayName,
      context,
    });

    if (!reply) {
      return NextResponse.json(
        {
          error:
            "Handicaper AI is unavailable. Check OPENAI_API_KEY or ANTHROPIC_API_KEY.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ reply, displayName });
  } catch (e) {
    console.error("POST /api/ai/handicaper/chat", e);
    return NextResponse.json(
      { error: "Handicaper failed to respond" },
      { status: 500 }
    );
  }
}
