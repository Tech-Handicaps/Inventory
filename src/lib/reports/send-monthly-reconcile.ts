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
  buildStockBreakdownReport,
  stockStatusInclude,
} from "@/lib/reports/stock-reconcile";
import { renderStockBreakdownPdf } from "@/lib/pdf/render-stock-breakdown-report";

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

/**
 * For scheduled (cron) reports the label should reference the *previous* month
 * because the cron fires on the 1st of the new month to close off the prior
 * period — e.g. cron fires 1 Aug → "For month ending July 2026".
 */
export function previousMonthLabel(now = new Date()): {
  monthKey: string;
  monthLabel: string;
  monthEndingLabel: string;
} {
  const { year, month } = johannesburgNowParts(now);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const monthKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  const monthLabel = new Date(
    Date.UTC(prevYear, prevMonth - 1, 1)
  ).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return { monthKey, monthLabel, monthEndingLabel: `For month ending ${monthLabel}` };
}

async function buildReconcilePdfs(
  mode: MonthlyReconcileSendMode
): Promise<{
  reconcileBuffer: Buffer;
  breakdownBuffer: Buffer;
  monthLabel: string;
  monthEndingLabel: string;
  monthKey: string;
  generatedAt: string;
}> {
  const isCron = mode === "cron";
  const prev = previousMonthLabel();
  const cur = johannesburgNowParts();

  const reportMonthLabel = isCron ? prev.monthLabel : cur.monthLabel;
  const reportMonthKey = isCron ? prev.monthKey : cur.monthKey;
  const monthEndingLabel = isCron
    ? prev.monthEndingLabel
    : `For month ending ${cur.monthLabel}`;

  const assets = await prisma.asset.findMany({
    include: stockStatusInclude,
  });
  const reconcileReport = buildStockReconcileReport(assets);
  const breakdownReport = buildStockBreakdownReport(assets);
  const logoSource = await loadLogoForPdf();
  const generatedAt = new Date().toLocaleString("en-ZA", { timeZone: TZ });

  const [reconcileBuffer, breakdownBuffer] = await Promise.all([
    renderReconcileReportPdf({
      title: "Monthly Stock Reconcile Report",
      subtitle: `Finance reconciliation — ${monthEndingLabel} · stock and full register by asset type`,
      generatedAt,
      logoSource,
      report: reconcileReport,
    }),
    renderStockBreakdownPdf({
      title: "Stock Breakdown by Make / Model",
      subtitle: `${monthEndingLabel} · new stock, refurbished, and written-off itemised`,
      generatedAt,
      logoSource,
      report: breakdownReport,
    }),
  ]);

  return {
    reconcileBuffer,
    breakdownBuffer,
    monthLabel: reportMonthLabel,
    monthEndingLabel,
    monthKey: reportMonthKey,
    generatedAt,
  };
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
    const pdf = await buildReconcilePdfs(options.mode);
    const attachments = [
      {
        filename: `hna-monthly-stock-reconcile-${pdf.monthKey}.pdf`,
        content: pdf.reconcileBuffer,
        contentType: "application/pdf",
      },
      {
        filename: `hna-stock-breakdown-${pdf.monthKey}.pdf`,
        content: pdf.breakdownBuffer,
        contentType: "application/pdf",
      },
    ];

    const result = await sendPersonalizedFinanceEmails(
      settings,
      recipients,
      (greeting) =>
        buildMonthlyReconcileEmail({
          greeting,
          monthLabel: pdf.monthLabel,
          monthEndingLabel: pdf.monthEndingLabel,
          appUrl: appBaseUrl(),
        }),
      { attachments, monthLabel: pdf.monthLabel }
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
      notes: `Monthly reconcile emailed — ${pdf.monthEndingLabel} (${result.sent} sent, ${result.failed} failed)`,
      metadata: {
        mode: options.mode,
        monthKey,
        reportMonthKey: pdf.monthKey,
        reportMonthLabel: pdf.monthLabel,
        monthEndingLabel: pdf.monthEndingLabel,
        sent: result.sent,
        failed: result.failed,
        recipients: recipients.map((r) => r.email),
      },
    });

    return {
      ok: true,
      monthKey,
      monthLabel: pdf.monthLabel,
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
