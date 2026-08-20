/**
 * Handicaper AI — OpenAI (primary) + Anthropic (fallback).
 */

import type { HandicaperInventoryContext } from "@/lib/ai/handicaper-context";

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
- How to use the app: Dashboard (metrics), Hardware board (Kanban), All assets (table), Reports (PDFs)

Rules:
- Answer using ONLY the live inventory snapshot provided — never invent asset counts or names.
- If the data does not contain the answer, say so and suggest where in the app to look (e.g. All assets, Reports).
- Be concise: 2-5 sentences unless the user asks for detail.
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

  const system = `${CHAT_SYSTEM_PROMPT}\n\n${nameHint}\n${pageHint}\n\nLive inventory snapshot (JSON):\n${contextJson}`;

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
    500
  );
  if (openai) return openai;

  return callAnthropic(system, messages, 500);
}
