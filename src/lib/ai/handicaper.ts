/**
 * Handicaper AI — OpenAI (primary) + Anthropic (fallback).
 */

import type { HandicaperInventoryContext } from "@/lib/ai/handicaper-context";
import type { ClubMovementSnapshot } from "@/lib/ai/handicaper-club-movement";

const METRIC_SYSTEM_PROMPT = `You are "Handicaper", an AI assistant embedded in the Handicaps Network Africa (HNA) Inventory Management System. Your job is to explain inventory metrics to operations and finance staff in clear, concise language.

Rules:
- Be direct and professional, no fluff.
- Use plain English, avoid jargon.
- Reference the actual numbers from the data provided.
- Keep your response to 2-4 sentences.
- Highlight anything noteworthy (e.g. concentration in one model, low refurb stock).
- Do not invent data — only use what is provided.`;

const CHAT_SYSTEM_PROMPT = `You are "Handicaper", the friendly AI assistant for the Handicaps Network Africa (HNA) Hardware Inventory system.

You help operations, technicians, and finance staff understand:
- Asset counts, lifecycle status (new stock, deployed, repair, refurbished, written off)
- Terminals, computers, AIO vs card readers (USB HID MSR)
- Fleet composition, SKU/model mix, clubs, repairs, write-offs
- **In-stock breakdown**: use \`stockByModel\` — every manufacturer/model in new stock or refurbished, with new vs refurb counts and asset type
- How to use the app: Dashboard (metrics), Hardware board (Kanban), All assets (table), Reports (PDFs)

**CSV exports (built into this chat — you provide them; do NOT send users elsewhere):**
- **Stock by model** — when the user asks for models in stock / stock breakdown; a table + Download CSV button appears below your message.
- **Full asset registry** — when the user asks to export all / registered assets; a Download CSV button appears for every asset row (status, model, club, serial, etc.).
- **Club movement** — when the user asks about hardware at a golf club (active vs written-off, replacement pairs, chronological timeline); tables + timeline + Download CSV appear below.
- **Metric breakdown** — when explaining a dashboard KPI card.

Rules:
- Answer using ONLY the live inventory snapshot provided — never invent asset counts or names.
- When \`clubMovementSnapshot\` is provided, summarise active vs retired hardware at that club, call out replacement pairs, and narrate the key chronological movement story from \`timeline\` (old terminal written off → new unit deployed, etc.). Point to the tables / timeline / Download CSV below.
- NEVER say you cannot generate or download CSV when an export is attached to this response (see \`responseAttachments\` below).
- NEVER tell users to look for Export/Download buttons on the All assets page or in Reports — those UI controls do not exist; exports happen here in Handicaper chat only.
- For club questions without a matched club in the snapshot, ask for the full club name and mention known clubs if listed in \`clubMatchHint\`.
- When asked for models in stock, available stock, or a stock breakdown, list items from \`stockByModel\` (group by asset type if helpful).
- If \`stockByModel\` is empty, say nothing is currently in new stock or refurbished.
- If the data does not contain the answer, say so and suggest where in the app to look (e.g. All assets, Reports).
- For breakdown requests, use a clear list or table format with make/model, new, refurb, and total.
- When you show a stock breakdown, tell the user they can download it as CSV using the button below the table (or that it will download automatically if they asked for CSV).
- Be concise for simple questions; use full detail when the user asks for a breakdown.
- Professional but warm — you represent HNA's inventory team.
- The user may be on any page; use the "current page" hint when relevant.`;

type ExplainInput = {
  metricLabel: string;
  dataJson: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatInput = {
  message: string;
  displayName?: string;
  page?: string;
  history?: ChatMessage[];
  context: HandicaperInventoryContext;
  /** Tells the model which CSV exports are attached to this response. */
  attachments?: {
    stockBreakdown?: boolean;
    assetRegistry?: boolean;
    assetCount?: number;
    clubMovement?: boolean;
    clubMovementSnapshot?: ClubMovementSnapshot;
    clubMatchHint?: string[];
  };
};

async function callOpenAi(
  system: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens = 300
): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: openaiKey });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxTokens,
      temperature: 0.35,
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch (e) {
    console.warn("Handicaper: OpenAI failed", e);
    return null;
  }
}

async function callAnthropic(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 300
): Promise<string | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey });
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system,
      messages,
    });
    const block = res.content[0];
    if (block.type === "text" && block.text.trim()) return block.text.trim();
    return null;
  } catch (e) {
    console.warn("Handicaper: Anthropic failed", e);
    return null;
  }
}

export async function generateAiSummary(
  input: ExplainInput
): Promise<string | null> {
  const userPrompt = `The user clicked on the "${input.metricLabel}" metric on the Dashboard. Here is the deterministic breakdown data:\n\n${input.dataJson}\n\nProvide a brief, insightful summary of this metric for operations/finance staff.`;

  const openai = await callOpenAi(METRIC_SYSTEM_PROMPT, [
    { role: "user", content: userPrompt },
  ]);
  if (openai) return openai;

  return callAnthropic(METRIC_SYSTEM_PROMPT, [{ role: "user", content: userPrompt }]);
}

export async function generateHandicaperChatReply(
  input: ChatInput
): Promise<string | null> {
  const contextJson = JSON.stringify(input.context, null, 2);
  const pageHint = input.page ? `Current page: ${input.page}.` : "";
  const nameHint = input.displayName
    ? `The user's first name is ${input.displayName}.`
    : "";

  let attachmentHint = "";
  const att = input.attachments;
  if (
    att?.stockBreakdown ||
    att?.assetRegistry ||
    att?.clubMovement ||
    att?.clubMatchHint
  ) {
    const parts: string[] = [];
    if (att.stockBreakdown) {
      parts.push(
        "stockByModel CSV export is attached — confirm the breakdown briefly and point to Download CSV below"
      );
    }
    if (att.assetRegistry && att.assetCount != null) {
      parts.push(
        `full asset registry CSV export is attached (${att.assetCount} assets) — confirm and point to Download CSV below`
      );
    }
    if (att.clubMovement && att.clubMovementSnapshot) {
      const s = att.clubMovementSnapshot;
      parts.push(
        `club movement for ${s.clubName} is attached (${s.active.length} active, ${s.retired.length} retired, ${s.replacementPairs.length} replacement pairs, ${s.timelineTotal} timeline events — ${s.timeline.length} shown) — summarise the site story from the timeline and point to tables / Download CSV below`
      );
    }
    if (parts.length > 0) {
      attachmentHint = `\n\nresponseAttachments: ${parts.join("; ")}`;
    }
    if (att.clubMatchHint?.length) {
      attachmentHint += `\n\nclubMatchHint (no club matched — suggest one of these): ${att.clubMatchHint.join(", ")}`;
    }
  }

  const clubJson = att?.clubMovementSnapshot
    ? `\n\nclubMovementSnapshot (JSON):\n${JSON.stringify(att.clubMovementSnapshot, null, 2)}`
    : "";

  const system = `${CHAT_SYSTEM_PROMPT}\n\n${nameHint}\n${pageHint}${attachmentHint}${clubJson}\n\nLive inventory snapshot (JSON):\n${contextJson}`;

  const history = (input.history ?? []).slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages = [
    ...history,
    { role: "user" as const, content: input.message },
  ];

  const openai = await callOpenAi(
    system,
    messages.map((m) => ({ role: m.role, content: m.content })),
    input.attachments?.clubMovement ? 1100 : 800
  );
  if (openai) return openai;

  return callAnthropic(
    system,
    messages,
    input.attachments?.clubMovement ? 1100 : 800
  );
}
