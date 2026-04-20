/**
 * Resend API via fetch — no extra dependency. Configure RESEND_API_KEY + verified sender domain.
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

export type SendHtmlEmailParams = {
  to: string[];
  subject: string;
  html: string;
  from: string;
  replyTo?: string | null;
};

export type SendHtmlEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function sendHtmlEmailViaResend(
  params: SendHtmlEmailParams
): Promise<SendHtmlEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" };
  }

  const to = params.to.map((e) => e.trim()).filter(Boolean);
  if (to.length === 0) {
    return { ok: false, error: "No recipients" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to,
        subject: params.subject,
        html: params.html,
        ...(params.replyTo?.trim()
          ? { reply_to: params.replyTo.trim() }
          : {}),
      }),
    });

    const text = await res.text();
    let json: { id?: string; message?: string } = {};
    try {
      json = JSON.parse(text) as { id?: string; message?: string };
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      return {
        ok: false,
        error: json.message ?? text.slice(0, 200) ?? `HTTP ${res.status}`,
      };
    }

    return { ok: true, id: json.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Resend request failed",
    };
  }
}
