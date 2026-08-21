import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { displayNameFromUser } from "@/lib/auth/display-name";
import { buildHandicaperInventoryContext, wantsStockBreakdown } from "@/lib/ai/handicaper-context";
import {
  buildAssetRegistryExportRows,
  sanitizeHandicaperExportReply,
  wantsAssetRegistryExport,
} from "@/lib/ai/handicaper-exports";
import {
  buildClubMovementReply,
  buildClubMovementSnapshot,
  clubNotFoundReply,
  listClubNames,
  resolveClubFromMessage,
  wantsClubMovement,
} from "@/lib/ai/handicaper-club-movement";
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
    const page = typeof body.page === "string" ? body.page : undefined;
    const clubMatch = await resolveClubFromMessage(message);
    const includeClubMovement = wantsClubMovement(message, clubMatch);
    const includeStockBreakdown =
      !includeClubMovement && wantsStockBreakdown(message);
    const includeAssetRegistry =
      !includeClubMovement &&
      wantsAssetRegistryExport(message, page);

    const contextPromise = buildHandicaperInventoryContext();
    const assetExportPromise = includeAssetRegistry
      ? buildAssetRegistryExportRows()
      : Promise.resolve(null);
    const clubMovementPromise =
      includeClubMovement && clubMatch
        ? buildClubMovementSnapshot(clubMatch.id, clubMatch.name)
        : Promise.resolve(null);
    const clubNamesPromise =
      includeClubMovement && !clubMatch
        ? listClubNames()
        : Promise.resolve(null);

    const [context, assetExportRows, clubMovement, clubNames] =
      await Promise.all([
        contextPromise,
        assetExportPromise,
        clubMovementPromise,
        clubNamesPromise,
      ]);

    const displayName = displayNameFromUser(auth.user);

    if (includeClubMovement && !clubMatch) {
      return NextResponse.json({
        reply: clubNotFoundReply(displayName, clubNames ?? []),
        displayName,
        clubNotFound: true,
        availableClubs: clubNames ?? [],
      });
    }

    // Club movement: answer from live snapshot (LLM was inventing "no hardware")
    if (includeClubMovement && clubMovement) {
      const reply = buildClubMovementReply(clubMovement, displayName);
      return NextResponse.json({
        reply,
        displayName,
        clubMovement,
      });
    }

    let reply = await generateHandicaperChatReply({
      message,
      page,
      history: Array.isArray(body.history) ? body.history : [],
      displayName,
      context,
      attachments: {
        stockBreakdown: includeStockBreakdown,
        assetRegistry: includeAssetRegistry,
        assetCount: assetExportRows?.length,
      },
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

    if (includeAssetRegistry && assetExportRows) {
      reply = sanitizeHandicaperExportReply(
        reply,
        "assets",
        assetExportRows.length,
        displayName
      );
    } else if (includeStockBreakdown && context.stockByModel.length > 0) {
      reply = sanitizeHandicaperExportReply(
        reply,
        "stock",
        context.stockByModel.length,
        displayName
      );
    }

    return NextResponse.json({
      reply,
      displayName,
      ...(includeStockBreakdown
        ? { stockBreakdown: context.stockByModel }
        : {}),
      ...(includeAssetRegistry && assetExportRows
        ? { assetExport: assetExportRows }
        : {}),
    });
  } catch (e) {
    console.error("POST /api/ai/handicaper/chat", e);
    return NextResponse.json(
      { error: "Handicaper failed to respond" },
      { status: 500 }
    );
  }
}
