/**
 * Handicaper AI — enhances deterministic metric breakdowns with
 * natural-language summaries using OpenAI (primary) or Anthropic (fallback).
 */

const SYSTEM_PROMPT = `You are "Handicaper", an AI assistant embedded in the Handicaps Network Africa (HNA) Inventory Management System. Your job is to explain inventory metrics to operations and finance staff in clear, concise language.

Rules:
- Be direct and professional, no fluff.
- Use plain English, avoid jargon.
- Reference the actual numbers from the data provided.
- Keep your response to 2-4 sentences.
- Highlight anything noteworthy (e.g. concentration in one model, low refurb stock).
- Do not invent data — only use what is provided.`;

type ExplainInput = {
  metricLabel: string;
  dataJson: string;
};

export async function generateAiSummary(
  input: ExplainInput
): Promise<string | null> {
  const userPrompt = `The user clicked on the "${input.metricLabel}" metric on the Dashboard. Here is the deterministic breakdown data:\n\n${input.dataJson}\n\nProvide a brief, insightful summary of this metric for operations/finance staff.`;

  // Try OpenAI first
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: openaiKey });
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      });
      const text = res.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e) {
      console.warn("Handicaper: OpenAI failed, trying Anthropic fallback", e);
    }
  }

  // Fallback to Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: anthropicKey });
      const res = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const block = res.content[0];
      if (block.type === "text" && block.text.trim()) return block.text.trim();
    } catch (e) {
      console.warn("Handicaper: Anthropic fallback also failed", e);
    }
  }

  return null;
}
