import type { EmailNotificationSettingsResolved } from "@/lib/email/email-settings";
import { sendHtmlEmailViaResend } from "@/lib/email/resend-send";
import { sendHtmlEmailViaSmtp } from "@/lib/email/smtp-send";

export type SendHtmlEmailInput = {
  to: string[];
  subject: string;
  html: string;
  from: string;
  replyTo?: string | null;
};

export type SendHtmlEmailUnifiedResult =
  | { ok: true; provider: "resend_rest" | "smtp"; id?: string }
  | { ok: false; error: string };

/**
 * Sends using the transport selected in settings. When `smtp`, the Resend HTTP API is not used.
 */
export async function sendHtmlEmailUnified(
  settings: EmailNotificationSettingsResolved,
  params: SendHtmlEmailInput
): Promise<SendHtmlEmailUnifiedResult> {
  if (settings.emailTransport === "smtp") {
    const r = await sendHtmlEmailViaSmtp({
      to: params.to,
      subject: params.subject,
      html: params.html,
      from: params.from,
      replyTo: params.replyTo,
    });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, provider: "smtp", id: r.messageId };
  }

  const r = await sendHtmlEmailViaResend({
    to: params.to,
    subject: params.subject,
    html: params.html,
    from: params.from,
    replyTo: params.replyTo,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, provider: "resend_rest", id: r.id };
}
