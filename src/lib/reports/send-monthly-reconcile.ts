import { createAuditLog } from "@/lib/audit/audit-log";
import {
  getEmailNotificationSettings,
  isSenderConfiguredForTransport,
} from "@/lib/email/email-settings";
import { sendPersonalizedFinanceEmails } from "@/lib/email/send-personalized-finance";
import { buildMonthlyReconcileEmail } from "@/lib/email/templates/hna-finance-email";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderFinanceFieldListingPdf } from "@/lib/pdf/render-finance-field-listing";
import { renderFinanceMonthOnMonthPdf } from "@/lib/pdf/render-finance-month-on-month";
import { renderFinanceYearlyPdf } from "@/lib/pdf/render-finance-yearly";
import { renderReconcileReportPdf } from "@/lib/pdf/render-reconcile-report";
import { prisma } from "@/lib/prisma";
import {
  buildStockReconcileReport,
  buildStockBreakdownReport,
  stockStatusInclude,
} from "@/lib/reports/stock-reconcile";
import { renderStockBreakdownPdf } from "@/lib/pdf/render-stock-breakdown-report";
import {
  financeFieldListing,
  financePackSnapshot,
  shouldKeepOfficialPack,
} from "@/lib/reports/finance-month-pack";
import {
  buildFinanceMonthOnMonth,
  financePositionFromSnapshot,
} from "@/lib/reports/finance-month-on-month";
import { loadStoredFinancePositions, loadDecember2025Workbook } from "@/lib/reports/load-finance-month-positions";
import { buildFinanceYearly } from "@/lib/reports/finance-yearly";
import { storeOfficialFinancePack } from "@/lib/reports/store-finance-month-pack";

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
 * The month printed on the PDF. A scheduled run closes the previous month.
 * A manual test prints the current month and is not the official file.
 */
export function reconcileReportMonth(
  mode: MonthlyReconcileSendMode,
  now = new Date()
): {
  monthKey: string;
  monthLabel: string;
  monthEndingLabel: string;
} {
  if (mode === "cron") return previousMonthLabel(now);
  const current = johannesburgNowParts(now);
  return {
    monthKey: current.monthKey,
    monthLabel: current.monthLabel,
    monthEndingLabel: `For month ending ${current.monthLabel}`,
  };
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
  mode: MonthlyReconcileSendMode,
  now = new Date()
): Promise<{
  reconcileBuffer: Buffer;
  breakdownBuffer: Buffer;
  reconcileReport: ReturnType<typeof buildStockReconcileReport>;
  breakdownReport: ReturnType<typeof buildStockBreakdownReport>;
  fieldUnits: ReturnType<typeof financeFieldListing>;
  monthLabel: string;
  monthEndingLabel: string;
  monthKey: string;
  generatedAt: string;
}> {
  const reportMonth = reconcileReportMonth(mode, now);

  const assets = await prisma.asset.findMany({
    include: stockStatusInclude,
  });
  const reconcileReport = buildStockReconcileReport(assets);
  const breakdownReport = buildStockBreakdownReport(assets);
  const fieldUnits = financeFieldListing(assets);
  const logoSource = await loadLogoForPdf();
  const generatedAt = new Date().toLocaleString("en-ZA", { timeZone: TZ });

  const [reconcileBuffer, breakdownBuffer] = await Promise.all([
    renderReconcileReportPdf({
      title: "Monthly Stock Reconcile Report",
      subtitle: `Finance reconciliation — ${reportMonth.monthEndingLabel} · stock and full register by asset type`,
      generatedAt,
      logoSource,
      report: reconcileReport,
    }),
    renderStockBreakdownPdf({
      title: "Stock Breakdown by Make / Model",
      subtitle: `${reportMonth.monthEndingLabel} · new stock, refurbished, and written-off itemised`,
      generatedAt,
      logoSource,
      report: breakdownReport,
    }),
  ]);

  return {
    reconcileBuffer,
    breakdownBuffer,
    reconcileReport,
    breakdownReport,
    fieldUnits,
    monthLabel: reportMonth.monthLabel,
    monthEndingLabel: reportMonth.monthEndingLabel,
    monthKey: reportMonth.monthKey,
    generatedAt,
  };
}

/**
 * Send Monthly Stock Reconcile to finance recipients.
 * Cron mode: only on the configured day, once per report month printed on the PDF.
 * Manual test: sends the current month and does not record an official file.
 */
export async function sendMonthlyReconcileReport(options: {
  mode: MonthlyReconcileSendMode;
  userId?: string | null;
  /** When true (manual), ignore schedule day / last-sent checks. */
  force?: boolean;
}): Promise<MonthlyReconcileSendResult> {
  const settings = await getEmailNotificationSettings();
  const now = new Date();
  const { day } = johannesburgNowParts(now);
  const reportMonth = reconcileReportMonth(options.mode, now);
  const monthKey = reportMonth.monthKey;
  const monthLabel = reportMonth.monthLabel;

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
    if (settings.scheduleReconcileLastSentMonth === reportMonth.monthKey) {
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
    const pdf = await buildReconcilePdfs(options.mode, now);
    let monthOnMonthBuffer: Buffer | null = null;
    let yearlyBuffer: Buffer | null = null;
    let fieldListingBuffer: Buffer | null = null;
    if (options.mode === "cron") {
      const snapshot = financePackSnapshot(pdf.reconcileReport, pdf.breakdownReport);
      const stored = await loadStoredFinancePositions();
      const current = financePositionFromSnapshot(
        pdf.monthKey,
        pdf.monthEndingLabel,
        snapshot
      );
      const positions = stored.some((row) => row.monthKey === current.monthKey)
        ? stored
        : [...stored, current];
      const [logoSource, december2025] = await Promise.all([
        loadLogoForPdf(),
        loadDecember2025Workbook(),
      ]);
      const [monthOnMonth, yearly, fieldListing] = await Promise.all([
        renderFinanceMonthOnMonthPdf({
          report: buildFinanceMonthOnMonth(positions),
          generatedAt: pdf.generatedAt,
          logoSource,
        }),
        renderFinanceYearlyPdf({
          report: buildFinanceYearly({
            december2025,
            financePositions: positions,
          }),
          generatedAt: pdf.generatedAt,
          logoSource,
        }),
        renderFinanceFieldListingPdf({
          monthEndingLabel: pdf.monthEndingLabel,
          units: pdf.fieldUnits,
          generatedAt: pdf.generatedAt,
          logoSource,
        }),
      ]);
      monthOnMonthBuffer = monthOnMonth;
      yearlyBuffer = yearly;
      fieldListingBuffer = fieldListing;
    }
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
      ...(monthOnMonthBuffer
        ? [
            {
              filename: `hna-finance-month-on-month-${pdf.monthKey}.pdf`,
              content: monthOnMonthBuffer,
              contentType: "application/pdf",
            },
          ]
        : []),
      ...(yearlyBuffer
        ? [
            {
              filename: `hna-finance-yearly-${pdf.monthKey}.pdf`,
              content: yearlyBuffer,
              contentType: "application/pdf",
            },
          ]
        : []),
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
          includeMonthOnMonth: Boolean(monthOnMonthBuffer),
          includeYearly: Boolean(yearlyBuffer),
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

    let packKept: { stored: boolean; alreadyKept: boolean } | null = null;
    if (
      shouldKeepOfficialPack({
        mode: options.mode,
        sent: result.sent,
        alreadyKept: false,
      })
    ) {
      const existing = await prisma.financeMonthPack.findUnique({
        where: { monthKey: pdf.monthKey },
        select: { id: true },
      });
      if (
        shouldKeepOfficialPack({
          mode: options.mode,
          sent: result.sent,
          alreadyKept: Boolean(existing),
        })
      ) {
        try {
          if (!monthOnMonthBuffer || !yearlyBuffer || !fieldListingBuffer) {
            throw new Error("The finance comparison PDFs were not prepared");
          }
          packKept = await storeOfficialFinancePack({
            monthKey: pdf.monthKey,
            monthLabel: pdf.monthLabel,
            monthEndingLabel: pdf.monthEndingLabel,
            recipientCount: result.sent,
            reconcilePdf: pdf.reconcileBuffer,
            breakdownPdf: pdf.breakdownBuffer,
            monthOnMonthPdf: monthOnMonthBuffer,
            yearlyPdf: yearlyBuffer,
            fieldListingPdf: fieldListingBuffer,
            reconcile: pdf.reconcileReport,
            breakdown: pdf.breakdownReport,
            fieldUnits: pdf.fieldUnits,
          });
        } catch (storeError) {
          const message =
            storeError instanceof Error
              ? storeError.message
              : "Failed to store the official finance pack";
          await createAuditLog({
            userId: options.userId ?? null,
            actionType: "report.monthly_reconcile_email",
            notes: `Monthly reconcile emailed — ${pdf.monthEndingLabel}, but the pack was not stored`,
            metadata: {
              mode: options.mode,
              monthKey: pdf.monthKey,
              official: true,
              stored: false,
              sent: result.sent,
              failed: result.failed,
            },
          });
          return {
            ok: false,
            monthKey,
            monthLabel,
            sent: result.sent,
            failed: result.failed,
            error: message,
          };
        }
      } else {
        packKept = { stored: false, alreadyKept: true };
      }

      await prisma.emailNotificationSettings.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          scheduleReconcileLastSentMonth: pdf.monthKey,
          scheduleReconcileEnabled: true,
        },
        update: { scheduleReconcileLastSentMonth: pdf.monthKey },
      });
    }

    await createAuditLog({
      userId: options.userId ?? null,
      actionType: "report.monthly_reconcile_email",
      notes: `Monthly reconcile emailed — ${pdf.monthEndingLabel} (${result.sent} sent, ${result.failed} failed)`,
      metadata: {
        mode: options.mode,
        monthKey: pdf.monthKey,
        official: options.mode === "cron",
        stored: packKept?.stored ?? false,
        alreadyKept: packKept?.alreadyKept ?? false,
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
