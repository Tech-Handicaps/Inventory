import { prisma } from "@/lib/prisma";

export type EmailNotificationSettingsResolved = {
  sendEnabled: boolean;
  notifyOnRepair: boolean;
  notifyOnWrittenOff: boolean;
  financeEmails: string[];
  financeGreetingName: string | null;
  fromName: string;
  replyTo: string | null;
  /** From header value: `Name <email@domain>` — email from env. */
  fromAddress: string;
};

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

/**
 * `from` email must use a domain verified in Resend.
 */
export async function getEmailNotificationSettings(): Promise<EmailNotificationSettingsResolved> {
  const row = await prisma.emailNotificationSettings.findUnique({
    where: { id: "singleton" },
  });

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "";

  return {
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
