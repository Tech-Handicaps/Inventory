import { NextRequest, NextResponse } from "next/server";
import { requireEmailSettingsAdmin } from "@/lib/auth/require-email-settings-admin";
import { requireFinanceAckUser } from "@/lib/auth/require-finance-user";
import {
  getEmailNotificationSettings,
  financeRecipientEmails,
  isSenderConfiguredForTransport,
} from "@/lib/email/email-settings";
import { sendHtmlEmailUnified } from "@/lib/email/send-html-email";
import { nextResponseIfPrismaSchemaDrift } from "@/lib/prisma-error-response";
import { prisma } from "@/lib/prisma";

/** GET — read email / finance notification settings (admin, super_admin, accountant). */
export async function GET(request: NextRequest) {
  const auth = await requireFinanceAckUser(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const row = await prisma.emailNotificationSettings.findUnique({
      where: { id: "singleton" },
    });
    const resolved = await getEmailNotificationSettings();
    const smtpConfigured = Boolean(
      process.env.SMTP_HOST?.trim() &&
        process.env.SMTP_USER?.trim() &&
        process.env.SMTP_PASSWORD?.trim()
    );
    const senderOk = isSenderConfiguredForTransport(resolved);
    return NextResponse.json({
      emailTransport: resolved.emailTransport,
      sendEnabled: row?.sendEnabled ?? false,
      notifyOnRepair: row?.notifyOnRepair ?? true,
      notifyOnWrittenOff: row?.notifyOnWrittenOff ?? true,
      financeEmails: row?.financeEmails ?? "",
      financeGreetingName: row?.financeGreetingName ?? "",
      fromName: row?.fromName ?? "Handicaps Network Africa Inventory",
      replyTo: row?.replyTo ?? "",
      resendFromEmailConfigured: Boolean(
        process.env.RESEND_FROM_EMAIL?.trim() ||
          process.env.EMAIL_FROM?.trim() ||
          process.env.SMTP_FROM?.trim()
      ),
      resendApiKeyConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      smtpEnvConfigured: smtpConfigured,
      senderConfigured: senderOk.ok,
      senderBlockedReason: senderOk.ok ? null : senderOk.reason,
      resolvedFromPreview: resolved.fromAddress,
    });
  } catch (e) {
    const drift = nextResponseIfPrismaSchemaDrift(e);
    if (drift) return drift;
    console.error("GET /api/settings/email-notifications", e);
    return NextResponse.json(
      { error: "Failed to load email settings" },
      { status: 500 }
    );
  }
}

/** PATCH — update settings (admin / super_admin only). */
export async function PATCH(request: NextRequest) {
  const auth = await requireEmailSettingsAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sendEnabled = body.sendEnabled === true;
    const notifyOnRepair = body.notifyOnRepair !== false;
    const notifyOnWrittenOff = body.notifyOnWrittenOff !== false;
    const financeEmails =
      typeof body.financeEmails === "string" ? body.financeEmails : "";
    const financeGreetingName =
      typeof body.financeGreetingName === "string"
        ? body.financeGreetingName.trim() || null
        : null;
    const fromName =
      typeof body.fromName === "string" && body.fromName.trim()
        ? body.fromName.trim()
        : "Handicaps Network Africa Inventory";
    const replyTo =
      typeof body.replyTo === "string" && body.replyTo.trim()
        ? body.replyTo.trim()
        : null;
    const emailTransportRaw =
      typeof body.emailTransport === "string" ? body.emailTransport.trim() : "";
    const emailTransport =
      emailTransportRaw === "smtp" ? "smtp" : "resend_rest";

    const row = await prisma.emailNotificationSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        emailTransport,
        sendEnabled,
        notifyOnRepair,
        notifyOnWrittenOff,
        financeEmails,
        financeGreetingName,
        fromName,
        replyTo,
      },
      update: {
        emailTransport,
        sendEnabled,
        notifyOnRepair,
        notifyOnWrittenOff,
        financeEmails,
        financeGreetingName,
        fromName,
        replyTo,
      },
    });

    return NextResponse.json({ ok: true, row });
  } catch (e) {
    const drift = nextResponseIfPrismaSchemaDrift(e);
    if (drift) return drift;
    console.error("PATCH /api/settings/email-notifications", e);
    return NextResponse.json(
      { error: "Failed to save email settings" },
      { status: 500 }
    );
  }
}

/** POST — test email (admin / super_admin). Body: `{ "to"?: string }` */
export async function POST(request: NextRequest) {
  const auth = await requireEmailSettingsAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      to?: unknown;
    };
    const settings = await getEmailNotificationSettings();
    const to =
      typeof body.to === "string" && body.to.includes("@")
        ? body.to.trim()
        : financeRecipientEmails(settings)[0];

    if (!to) {
      return NextResponse.json(
        { error: "Provide a test address or configure finance emails." },
        { status: 400 }
      );
    }

    const sender = isSenderConfiguredForTransport(settings);
    if (!sender.ok) {
      const hints: Record<string, string> = {
        from_email_not_configured:
          "Set SMTP_FROM, EMAIL_FROM, or RESEND_FROM_EMAIL to a valid from address.",
        smtp_env_incomplete:
          "For SMTP, set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in environment.",
        resend_api_key_missing:
          "For Resend REST API, set RESEND_API_KEY (SMTP mode does not use it).",
      };
      return NextResponse.json(
        { error: hints[sender.reason] ?? `Sender not ready: ${sender.reason}` },
        { status: 400 }
      );
    }

    if (!settings.fromAddress.includes("@")) {
      return NextResponse.json(
        {
          error:
            "Set SMTP_FROM, EMAIL_FROM, or RESEND_FROM_EMAIL in environment variables.",
        },
        { status: 400 }
      );
    }

    const result = await sendHtmlEmailUnified(settings, {
      to: [to],
      subject: "HNA Inventory — test email",
      html: `<p>This is a test message from the inventory app.</p><p>Transport: <strong>${settings.emailTransport}</strong>.</p>`,
      from: settings.fromAddress,
      replyTo: settings.replyTo,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      id: result.id,
    });
  } catch (e) {
    console.error("POST /api/settings/email-notifications", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Test send failed" },
      { status: 500 }
    );
  }
}
