const ASSIST_PLACEHOLDER_VALUES = new Set([
  "n/a",
  "na",
  "unknown",
  "unknown manufacturer",
  "none",
  "not available",
  "-",
  "—",
]);

/** Treat empty strings and common Assist placeholders as missing hardware values. */
export function normalizeAssistHardwareValue(
  value: string | null | undefined
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (ASSIST_PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

/** Prefer a real Assist value; otherwise fall back to the matched device template. */
export function resolveHardwareFieldFromAssistAndTemplate(
  assistValue: string | null | undefined,
  templateValue: string | null | undefined
): string | undefined {
  const fromAssist = normalizeAssistHardwareValue(assistValue);
  if (fromAssist) return fromAssist;
  return normalizeAssistHardwareValue(templateValue);
}
