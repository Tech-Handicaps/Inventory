/**
 * Shared copy for email transport UI and API errors (no server-only imports).
 */

export type EmailTransportId = "resend_rest" | "smtp";

export const EMAIL_TRANSPORT_LABEL: Record<EmailTransportId, string> = {
  resend_rest: "Resend REST API",
  smtp: "SMTP",
};

/** Human-readable fix hints for `isSenderConfiguredForTransport` reason codes. */
export const SENDER_BLOCKED_REASON_MESSAGES: Record<string, string> = {
  from_email_not_configured:
    "Set SMTP_FROM, EMAIL_FROM, or RESEND_FROM_EMAIL to a valid address.",
  smtp_env_incomplete:
    "For SMTP, set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.",
  resend_api_key_missing:
    "For Resend REST API, set RESEND_API_KEY.",
};

export function describeSenderBlockedReason(
  code: string | null | undefined
): string | null {
  if (!code) return null;
  return SENDER_BLOCKED_REASON_MESSAGES[code] ?? code;
}

export function parseEmailTransport(
  raw: string | null | undefined
): EmailTransportId {
  return raw === "smtp" ? "smtp" : "resend_rest";
}

/** Radio rows for Settings → Email delivery transport. */
export const EMAIL_DELIVERY_OPTIONS: {
  id: EmailTransportId;
  title: string;
  detail: string;
}[] = [
  {
    id: "resend_rest",
    title: "Resend REST API",
    detail:
      "Uses RESEND_API_KEY over HTTPS (no SMTP connection from the app).",
  },
  {
    id: "smtp",
    title: "SMTP",
    detail:
      "Uses SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD (set SMTP_SECURE=true for port 465). The Resend HTTP API is not used.",
  },
];
