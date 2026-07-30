import { createAuditLog } from "@/lib/audit/audit-log";
import {
  getEmailNotificationSettings,
  isSenderConfiguredForTransport,
} from "@/lib/email/email-settings";
import { sendPersonalizedFinanceEmails } from "@/lib/email/send-personalized-finance";
import { buildMonthlyReconcileEmail } from "@/lib/email/templates/hna-finance-email";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderReconcileReportPdf } from "@/lib/pdf/render-reconcile-report";
import { prisma } from "@/lib/prisma";
import {
  buildStockReconcileReport,
  stockStatusInclude,
} from "@/lib/reports/stock-reconcile";

const TZ = "Africa/Johannesburg";

export type MonthlyReconcileSendMode = "cron" | "manual_test";

export type MonthlyReconcileSendResult = {
  ok: boolean;
  skipped?: string;
  monthKey?: string;
  monthLabel?: string;
  sent?: number;
  failed?: number;
  error?: string;
};

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  );
}

/** Calendar parts in Africa/Johannesburg. */
export function johannesburgNowParts(now = new Date()): {
  year: number;
  month: number;
  day: number;
  monthKey: string;
  monthLabel: string;
} {
  const fmt = new Intl.DateTimeFormat("en-ZA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "en-ZA",
    { year: "numeric", month: "long", timeZone: "UTC" }
  );
  return { year, month, day, monthKey, monthLabel };
}

async function buildReconcilePdfBuffer(): Promise<{
  buffer: Buffer;
  monthLabel: string;
  generatedAt: string;
}> {
  const { monthLabel } = johannesburgNowParts();
  const assets = await prisma.asset.findMany({
    include: stockStatusInclude,
  });
  const report = buildStockReconcileReport(assets);
  const logoSource = await loadLogoForPdf();
  const generatedAt = new Date().toLocaleString("en-ZA", { timeZone: TZ });
  const buffer = await renderReconcileReportPdf({
    title: "Monthly stock reconcile",
    subtitle: `Finance reconciliation — ${monthLabel} · stock and full register by asset type`,
    generatedAt,
    logoSource,
    report,
  });
  return { buffer, monthLabel, generatedAt };
}

/**
 * Send Monthly Stock Reconcile to finance recipients.
 * Cron mode: only on configured day-of-month, once per month (idempotent).
 * Manual test: always sends (does not update last-sent month unless cron).
 */
export async function sendMonthlyReconcileReport(options: {
  mode: MonthlyReconcileSendMode;
  userId?: string | null;
  /** When true (manual), ignore schedule day / last-sent checks. */
  force?: boolean;
}): Promise<MonthlyReconcileSendResult> {
  const settings = await getEmailNotificationSettings();
  const { day, monthKey, monthLabel } = johannesburgNowParts();

  if (options.mode === "cron" || !options.force) {
    if (!settings.scheduleReconcileEnabled) {
      return { ok: true, skipped: "schedule_disabled", monthKey, monthLabel };
    }
  }

  if (options.mode === "cron") {
    if (day !== settings.scheduleReconcileDayOfMonth) {
      return {
        ok: true,
        skipped: "not_scheduled_day",
        monthKey,
        monthLabel,
      };
    }
    if (settings.scheduleReconcileLastSentMonth === monthKey) {
      return {
        ok: true,
        skipped: "already_sent_this_month",
        monthKey,
        monthLabel,
      };
    }
  }

  if (!settings.sendEnabled && options.mode === "cron") {
    return { ok: true, skipped: "send_disabled", monthKey, monthLabel };
  }

  if (options.mode === "manual_test" && !settings.sendEnabled) {
    // Allow admin test even when master switch is off — but warn via skip if preferred?
    // Recommendation: manual test should still send so admins can verify. Proceed.
  }

  const recipients = settings.financeRecipients;
  if (recipients.length === 0) {
    return {
      ok: false,
      skipped: "no_finance_emails",
      monthKey,
      monthLabel,
      error: "No finance emails configured.",
    };
  }

  const sender = isSenderConfiguredForTransport(settings);
  if (!sender.ok) {
    return {
      ok: false,
      error: `Sender not ready: ${sender.reason}`,
      monthKey,
      monthLabel,
    };
  }

  if (!settings.fromAddress.includes("@")) {
    return {
      ok: false,
      error: "From email not configured in environment.",
      monthKey,
      monthLabel,
    };
  }

  try {
    const { buffer } = await buildReconcilePdfBuffer();
    const filename = `hna-monthly-stock-reconcile-${monthKey}.pdf`;
    const attachments = [
      {
        filename,
        content: buffer,
        contentType: "application/pdf",
      },
    ];

    const result = await sendPersonalizedFinanceEmails(
      settings,
      recipients,
      (greeting) =>
        buildMonthlyReconcileEmail({
          greeting,
          monthLabel,
          appUrl: appBaseUrl(),
        }),
      { attachments, monthLabel }
    );

    if (result.sent === 0) {
      return {
        ok: false,
        monthKey,
        monthLabel,
        sent: 0,
        failed: result.failed,
        error: result.lastError ?? "All sends failed",
      };
    }

    if (options.mode === "cron") {
      await prisma.emailNotificationSettings.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          scheduleReconcileLastSentMonth: monthKey,
          scheduleReconcileEnabled: true,
        },
        update: { scheduleReconcileLastSentMonth: monthKey },
      });
    }

    await createAuditLog({
      userId: options.userId ?? null,
      actionType: "report.monthly_reconcile_email",
      notes: `Monthly reconcile emailed for ${monthLabel} (${result.sent} sent, ${result.failed} failed)`,
      metadata: {
        mode: options.mode,
        monthKey,
        monthLabel,
        sent: result.sent,
        failed: result.failed,
        recipients: recipients.map((r) => r.email),
      },
    });

    return {
      ok: true,
      monthKey,
      monthLabel,
      sent: result.sent,
      failed: result.failed,
      error: result.failed > 0 ? result.lastError ?? undefined : undefined,
    };
  } catch (e) {
    console.error("sendMonthlyReconcileReport", e);
    return {
      ok: false,
      monthKey,
      monthLabel,
      error: e instanceof Error ? e.message : "Failed to send reconcile report",
    };
  }
}
