/**
 * Finance recipient parsing and personalized greeting helpers.
 * Supports: `email@domain`, `Name <email@domain>`, and template tokens `{name}`, `{email}`, `{month}`.
 */

export type FinanceRecipient = {
  email: string;
  /** Display name from `Name <email>` when present. */
  name: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Default when neither recipient name nor settings fallback is set. */
export const DEFAULT_FINANCE_GREETING_NAME = "Finance team";

/**
 * Parse finance recipient list. Accepts comma, semicolon, or newline separators.
 * Formats: `a@b.co`, `Jane Smith <jane@b.co>`, `"Jane Smith" <jane@b.co>`.
 */
export function parseFinanceRecipients(raw: string): FinanceRecipient[] {
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: FinanceRecipient[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const angled = part.match(/^(?:"([^"]+)"|([^<]+?))\s*<([^>]+)>\s*$/);
    let email: string;
    let name: string | null = null;

    if (angled) {
      name = (angled[1] ?? angled[2] ?? "").trim() || null;
      email = angled[3].trim().toLowerCase();
    } else {
      email = part.toLowerCase();
    }

    if (!EMAIL_RE.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name });
  }

  return out;
}

export function financeRecipientEmailsFromRaw(raw: string): string[] {
  return parseFinanceRecipients(raw).map((r) => r.email);
}

/** Resolve display name for a recipient. */
export function resolveRecipientDisplayName(
  recipient: FinanceRecipient,
  fallbackGreetingName: string | null | undefined
): string {
  if (recipient.name?.trim()) return recipient.name.trim();
  const fallback = fallbackGreetingName?.trim();
  if (fallback && !/\{[a-z]+\}/i.test(fallback)) return fallback;
  return DEFAULT_FINANCE_GREETING_NAME;
}

export type EmailTemplateVars = {
  name: string;
  email: string;
  month?: string;
};

/** Replace `{name}`, `{email}`, `{month}` in a template string. */
export function applyEmailTemplate(
  template: string,
  vars: EmailTemplateVars
): string {
  return template
    .replace(/\{name\}/gi, vars.name)
    .replace(/\{email\}/gi, vars.email)
    .replace(/\{month\}/gi, vars.month ?? "");
}

/**
 * Build greeting line. If `financeGreetingName` contains `{name}` (or other tokens),
 * treat it as a full greeting template (e.g. `Hi {name},`). Otherwise `Hi {resolvedName},`.
 */
export function greetingLineForRecipient(
  recipient: FinanceRecipient,
  financeGreetingName: string | null | undefined,
  extraVars?: Pick<EmailTemplateVars, "month">
): string {
  const name = resolveRecipientDisplayName(recipient, financeGreetingName);
  const vars: EmailTemplateVars = {
    name,
    email: recipient.email,
    month: extraVars?.month,
  };

  const raw = financeGreetingName?.trim();
  if (raw && /\{[a-z]+\}/i.test(raw)) {
    const rendered = applyEmailTemplate(raw, vars).trim();
    if (/,$/.test(rendered)) return rendered;
    return `${rendered},`;
  }

  return `Hi ${name},`;
}
