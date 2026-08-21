export const HANDICAPER_CAPABILITIES = [
  "Stock levels & model breakdowns — with CSV export",
  "Club asset movement (active, retired, timeline)",
  "Explain any dashboard metric",
  "Export the full asset registry",
] as const;

export type HandicaperWelcome = {
  greeting: string;
  intro: string;
  prompt: string;
  capabilities: readonly string[];
  cta: string;
};

export function buildHandicaperWelcome(
  displayName?: string | null
): HandicaperWelcome {
  const who = displayName?.trim() || "there";
  return {
    greeting: `Hey ${who}!`,
    intro:
      "Welcome to the Handicaps Network Africa Inventory system. I'm Handicaper — happy to help you find your way around.",
    prompt: "What would you like to achieve today?",
    capabilities: HANDICAPER_CAPABILITIES,
    cta: "Click me to chat — just ask in plain English.",
  };
}

/** Plain-text welcome for the chat modal (matches mascot copy). */
export function buildModalWelcomeMessage(
  displayName?: string | null
): string {
  const w = buildHandicaperWelcome(displayName);
  const bullets = w.capabilities.map((c) => `• ${c}`).join("\n");
  return `${w.greeting} ${w.intro}\n\n${w.prompt}\n\n${bullets}\n\n${w.cta}`;
}

/** Single line for compact idle prompts (unchanged tone). */
export function buildMascotShortGreeting(
  displayName?: string | null,
  pageLabel?: string
): string {
  const who = displayName?.trim() || "there";
  const area = pageLabel ? ` on ${pageLabel}` : "";
  return `Hi ${who}! Need help${area}? Click me — I can explain stock, clubs, metrics, and exports.`;
}
