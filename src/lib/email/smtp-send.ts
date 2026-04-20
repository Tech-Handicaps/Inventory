import nodemailer from "nodemailer";

export type SendHtmlEmailParams = {
  to: string[];
  subject: string;
  html: string;
  from: string;
  replyTo?: string | null;
};

export type SendHtmlEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

/**
 * SMTP delivery using env: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD,
 * SMTP_SECURE (true for 465 implicit TLS).
 * Optional: SMTP_FROM for raw from address; otherwise From header uses `from` param.
 */
export async function sendHtmlEmailViaSmtp(
  params: SendHtmlEmailParams
): Promise<SendHtmlEmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const user = process.env.SMTP_USER?.trim();

  if (!host || !pass) {
    return {
      ok: false,
      error: "Set SMTP_HOST and SMTP_PASSWORD in environment variables.",
    };
  }
  if (!user) {
    return {
      ok: false,
      error:
        "Set SMTP_USER in environment (e.g. resend for smtp.resend.com, or your mailbox user).",
    };
  }

  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const to = params.to.map((e) => e.trim()).filter(Boolean);
    if (to.length === 0) {
      return { ok: false, error: "No recipients" };
    }

    const info = await transporter.sendMail({
      from: params.from,
      to: to.join(", "),
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo?.trim() || undefined,
    });

    return {
      ok: true,
      messageId: info.messageId,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "SMTP send failed",
    };
  }
}
