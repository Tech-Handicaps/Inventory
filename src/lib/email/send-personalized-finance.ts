import type { EmailNotificationSettingsResolved } from "@/lib/email/email-settings";
import { enrichFinanceRecipientsFromProfiles } from "@/lib/email/enrich-finance-recipients";
import {
  greetingLineForRecipient,
  type FinanceRecipient,
} from "@/lib/email/finance-recipients";
import {
  sendHtmlEmailUnified,
  type EmailAttachment,
} from "@/lib/email/send-html-email";

export type PersonalizedFinanceSendResult = {
  sent: number;
  failed: number;
  lastError: string | null;
};

/**
 * Send one personalized email per finance recipient (so `{name}` greetings are correct).
 * Missing names are filled from UserProfile when the email matches an app user.
 */
export async function sendPersonalizedFinanceEmails(
  settings: EmailNotificationSettingsResolved,
  recipients: FinanceRecipient[],
  build: (
    greeting: string,
    recipient: FinanceRecipient
  ) => { subject: string; html: string },
  options?: {
    attachments?: EmailAttachment[];
    /** Extra vars for greeting templates (e.g. month label). */
    monthLabel?: string;
  }
): Promise<PersonalizedFinanceSendResult> {
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  const personalized = await enrichFinanceRecipientsFromProfiles(recipients);

  for (const recipient of personalized) {
    const greeting = greetingLineForRecipient(
      recipient,
      settings.financeGreetingName,
      options?.monthLabel ? { month: options.monthLabel } : undefined
    );
    const { subject, html } = build(greeting, recipient);
    const result = await sendHtmlEmailUnified(settings, {
      to: [recipient.email],
      subject,
      html,
      from: settings.fromAddress,
      replyTo: settings.replyTo,
      attachments: options?.attachments,
    });
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      lastError = result.error;
    }
  }

  return { sent, failed, lastError };
}
