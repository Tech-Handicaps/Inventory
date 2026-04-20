import {
  parseEmailTransport,
  type EmailTransportId,
} from "@/lib/email/email-notification-copy";
import { prisma } from "@/lib/prisma";

export type EmailTransport = EmailTransportId;

export type EmailNotificationSettingsResolved = {
  emailTransport: EmailTransport;
  sendEnabled: boolean;
  notifyOnRepair: boolean;
  notifyOnWrittenOff: boolean;
  financeEmails: string[];
  financeGreetingName: string | null;
  fromName: string;
  replyTo: string | null;
  /** From header value: `Name <email@domain>` — email from env (see resolveFromEmailPart). */
  fromAddress: string;
};

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

/**
 * Single “from” mailbox for both Resend REST and SMTP (`SMTP_FROM`, `EMAIL_FROM`, or `RESEND_FROM_EMAIL`).
 */
export function resolveFromEmailPart(): string {
  return (
    process.env.SMTP_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    ""
  );
}

/**
 * Whether env is sufficient to send for the selected transport.
 */
export function isSenderConfiguredForTransport(
  settings: EmailNotificationSettingsResolved
): { ok: true } | { ok: false; reason: string } {
  const from = resolveFromEmailPart();
  if (!from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    return { ok: false, reason: "from_email_not_configured" };
  }

  if (settings.emailTransport === "smtp") {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASSWORD?.trim();
    if (!host || !user || !pass) {
      return { ok: false, reason: "smtp_env_incomplete" };
    }
    return { ok: true };
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    return { ok: false, reason: "resend_api_key_missing" };
  }
  return { ok: true };
}

export async function getEmailNotificationSettings(): Promise<EmailNotificationSettingsResolved> {
  const row = await prisma.emailNotificationSettings.findUnique({
    where: { id: "singleton" },
  });

  const transport = parseEmailTransport(row?.emailTransport);
  const fromEmail = resolveFromEmailPart();

  return {
    emailTransport: transport,
    sendEnabled: row?.sendEnabled ?? false,
    notifyOnRepair: row?.notifyOnRepair ?? true,
    notifyOnWrittenOff: row?.notifyOnWrittenOff ?? true,
    financeEmails: parseEmailList(row?.financeEmails ?? ""),
    financeGreetingName: row?.financeGreetingName?.trim() || null,
    fromName: row?.fromName?.trim() || "Handicaps Network Africa Inventory",
    replyTo: row?.replyTo?.trim() || null,
    fromAddress: fromEmail
      ? `${row?.fromName?.trim() || "Handicaps Network Africa Inventory"} <${fromEmail}>`
      : "",
  };
}

export function financeRecipientEmails(
  settings: EmailNotificationSettingsResolved
): string[] {
  return [...new Set(settings.financeEmails)];
}
