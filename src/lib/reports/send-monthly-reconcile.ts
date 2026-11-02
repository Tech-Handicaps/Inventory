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
import { financeFieldListing, financePackSnapshot } from "@/lib/reports/finance-month-pack";
import {
  buildFinanceMonthOnMonth,
  financePositionFromSnapshot,
} from "@/lib/reports/finance-month-on-month";
import { loadStoredFinancePositions, loadDecember2025Workbook } from "@/lib/reports/load-finance-month-positions";
import { buildFinanceYearly } from "@/lib/reports/finance-yearly";
import {
  loadStoredPackFiles,
  storeOfficialFinancePack,
  type StoredPackFile,
} from "@/lib/reports/store-finance-month-pack";
import { monthLabelOf } from "@/lib/reports/period-catalog";
import { invalidateReportPeriods } from "@/lib/reports/period-records";
import { formatDateTime } from "@/lib/dates/format";
import { notesPrefaceFor } from "@/lib/reports/auditor-notes";

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
  const generatedAt = formatDateTime(new Date());

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

export type OfficialPackMode = "cron" | "send_now" | "resend";

export type OfficialPackAction =
  | "generate_and_send"
  | "send_stored"
  | "skip_already_sent"
  | "refuse_already_stored"
  | "refuse_not_stored";

/**
 * What a run should do for the report month. Idempotent: a month that is stored and
 * emailed is never generated or sent again by the schedule. Months emailed before
 * packs were stored (Jul–Sep 2026) count as sent.
 */
export function officialPackAction(input: {
  mode: OfficialPackMode;
  packStored: boolean;
  sentBefore: boolean;
}): OfficialPackAction {
  if (input.mode === "resend") return input.packStored ? "send_stored" : "refuse_not_stored";
  if (input.mode === "send_now") {
    if (input.packStored) return "refuse_already_stored";
    return input.sentBefore ? "skip_already_sent" : "generate_and_send";
  }
  if (input.packStored) return input.sentBefore ? "skip_already_sent" : "send_stored";
  return input.sentBefore ? "skip_already_sent" : "generate_and_send";
}

async function logPackRun(entry: {
  monthKey: string;
  mode: OfficialPackMode | "manual_test";
  status: "sent" | "skipped" | "failed";
  reason?: string | null;
  sent?: number;
  failed?: number;
  recipients?: string[];
  error?: string | null;
  userId?: string | null;
}) {
  try {
    await prisma.financePackSendLog.create({
      data: {
        monthKey: entry.monthKey,
        mode: entry.mode,
        status: entry.status,
        reason: entry.reason ?? null,
        sent: entry.sent ?? 0,
        failed: entry.failed ?? 0,
        recipients: entry.recipients ?? [],
        error: entry.error ?? null,
        userId: entry.userId ?? null,
      },
    });
  } catch (error) {
    console.error("logPackRun", error);
  }
}

function attachmentName(kind: StoredPackFile["kind"], monthKey: string): string {
  switch (kind) {
    case "reconcile":
      return `hna-monthly-stock-reconcile-${monthKey}.pdf`;
    case "breakdown":
      return `hna-stock-breakdown-${monthKey}.pdf`;
    case "month-on-month":
      return `hna-finance-month-on-month-${monthKey}.pdf`;
    case "yearly":
      return `hna-finance-yearly-${monthKey}.pdf`;
    case "field":
      return `hna-finance-field-listing-${monthKey}.pdf`;
    default:
      return `hna-finance-pack-${monthKey}.csv`;
  }
}

/** Build every file of the official pack for `reportMonth` from the register now. */
async function buildOfficialPack(reportMonth: { monthKey: string; monthLabel: string; monthEndingLabel: string }, generatedBy: string) {
  const assets = await prisma.asset.findMany({ include: stockStatusInclude });
  const reconcileReport = buildStockReconcileReport(assets);
  const breakdownReport = buildStockBreakdownReport(assets);
  const fieldUnits = financeFieldListing(assets);
  const generatedAt = formatDateTime(new Date());
  const snapshot = financePackSnapshot(reconcileReport, breakdownReport);
  const stored = await loadStoredFinancePositions();
  const current = financePositionFromSnapshot(reportMonth.monthKey, reportMonth.monthEndingLabel, snapshot);
  const positions = stored.some((row) => row.monthKey === current.monthKey) ? stored : [...stored, current];
  const [logoSource, december2025, yearlyPreface, monthOnMonthPreface] = await Promise.all([
    loadLogoForPdf(),
    loadDecember2025Workbook(),
    notesPrefaceFor(["2025-12"]),
    notesPrefaceFor(positions.map((row) => row.monthKey)),
  ]);
  const [reconcilePdf, breakdownPdf, monthOnMonthPdf, yearlyPdf, fieldListingPdf] = await Promise.all([
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
    renderFinanceMonthOnMonthPdf({
      prefaceHtml: monthOnMonthPreface,
      report: buildFinanceMonthOnMonth(positions),
      generatedAt,
      logoSource,
    }),
    renderFinanceYearlyPdf({
      prefaceHtml: yearlyPreface,
      report: buildFinanceYearly({ december2025, financePositions: positions }),
      generatedAt,
      logoSource,
    }),
    renderFinanceFieldListingPdf({
      monthEndingLabel: reportMonth.monthEndingLabel,
      units: fieldUnits,
      generatedAt,
      logoSource,
    }),
  ]);
  return storeOfficialFinancePack({
    ...reportMonth,
    generatedBy,
    reconcilePdf,
    breakdownPdf,
    monthOnMonthPdf,
    yearlyPdf,
    fieldListingPdf,
    reconcile: reconcileReport,
    breakdown: breakdownReport,
    fieldUnits,
  });
}

/**
 * Official monthly pack. The scheduled run (any day, so a missed day catches up) closes
 * the previous calendar month in SAST: it generates and stores the pack, then emails the
 * stored files once. "Send now" does the same on demand; "Resend" emails a stored month again.
 */
export async function runOfficialPack(options: {
  mode: OfficialPackMode;
  userId?: string | null;
  /** Resend only: the stored month to email again. */
  monthKey?: string;
  now?: Date;
}): Promise<MonthlyReconcileSendResult> {
  const now = options.now ?? new Date();
  const settings = await getEmailNotificationSettings();
  const reportMonth =
    options.mode === "resend" && options.monthKey
      ? {
          monthKey: options.monthKey,
          monthLabel: monthLabelOf(options.monthKey),
          monthEndingLabel: `For month ending ${monthLabelOf(options.monthKey)}`,
        }
      : previousMonthLabel(now);
  const { monthKey, monthLabel } = reportMonth;
  const userId = options.userId ?? null;

  if (options.mode === "cron") {
    if (!settings.scheduleReconcileEnabled) return { ok: true, skipped: "schedule_disabled", monthKey, monthLabel };
    if (!settings.sendEnabled) return { ok: true, skipped: "send_disabled", monthKey, monthLabel };
  }

  const [pack, sentLog] = await Promise.all([
    prisma.financeMonthPack.findUnique({ where: { monthKey } }),
    prisma.financePackSendLog.findFirst({ where: { monthKey, status: "sent" }, select: { id: true } }),
  ]);
  const sentBefore = Boolean(sentLog) || settings.scheduleReconcileLastSentMonth === monthKey;
  const action = officialPackAction({ mode: options.mode, packStored: Boolean(pack), sentBefore });

  if (action === "skip_already_sent") {
    if (options.mode !== "cron") {
      await logPackRun({ monthKey, mode: options.mode, status: "skipped", reason: "already_sent", userId });
    }
    return { ok: true, skipped: "already_sent", monthKey, monthLabel };
  }
  if (action === "refuse_already_stored") {
    return { ok: false, monthKey, monthLabel, error: `${monthLabel} is already stored. Use Resend to email it again.` };
  }
  if (action === "refuse_not_stored") {
    return { ok: false, monthKey, monthLabel, error: `No stored pack for ${monthLabel}.` };
  }

  const recipients = settings.financeRecipients;
  const sender = isSenderConfiguredForTransport(settings);
  const notReady =
    recipients.length === 0
      ? "No finance emails configured."
      : !sender.ok
        ? `Sender not ready: ${sender.reason}`
        : !settings.fromAddress.includes("@")
          ? "From email not configured in environment."
          : null;

  try {
    let files: StoredPackFile[];
    if (action === "generate_and_send") {
      const result = await buildOfficialPack(reportMonth, userId ?? "system");
      if (result.stored) {
        files = result.files;
        await createAuditLog({
          userId,
          actionType: "report.pack_generated",
          notes: `Finance pack stored — ${reportMonth.monthEndingLabel}`,
          metadata: { monthKey, mode: options.mode, files: result.files.map((file) => file.path) },
        });
        invalidateReportPeriods();
      } else {
        const existing = await prisma.financeMonthPack.findUniqueOrThrow({ where: { monthKey } });
        files = await loadStoredPackFiles(existing);
      }
    } else {
      files = await loadStoredPackFiles(pack!);
    }

    if (notReady) {
      await logPackRun({ monthKey, mode: options.mode, status: "failed", error: notReady, userId });
      return { ok: false, monthKey, monthLabel, error: `Pack stored, but not emailed: ${notReady}` };
    }

    const emailFiles = files.filter((file) => file.kind !== "field");
    const result = await sendPersonalizedFinanceEmails(
      settings,
      recipients,
      (greeting) =>
        buildMonthlyReconcileEmail({
          greeting,
          monthLabel,
          monthEndingLabel: reportMonth.monthEndingLabel,
          appUrl: appBaseUrl(),
          includeMonthOnMonth: true,
          includeYearly: true,
        }),
      {
        attachments: emailFiles.map((file) => ({
          filename: attachmentName(file.kind, monthKey),
          content: file.body,
          contentType: file.contentType,
        })),
        monthLabel,
      }
    );
    const addresses = recipients.map((r) => r.email);

    if (result.sent === 0) {
      await logPackRun({
        monthKey,
        mode: options.mode,
        status: "failed",
        failed: result.failed,
        recipients: addresses,
        error: result.lastError ?? "All sends failed",
        userId,
      });
      await createAuditLog({
        userId,
        actionType: "report.pack_send_failed",
        notes: `Finance pack not emailed — ${reportMonth.monthEndingLabel}: ${result.lastError ?? "all sends failed"}. The next scheduled run will retry.`,
        metadata: { monthKey, mode: options.mode },
      });
      return { ok: false, monthKey, monthLabel, sent: 0, failed: result.failed, error: result.lastError ?? "All sends failed" };
    }

    await prisma.financeMonthPack.update({
      where: { monthKey },
      data: { recipientCount: result.sent, recipients: addresses, sentAt: new Date() },
    });
    if (options.mode !== "resend") {
      await prisma.emailNotificationSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", scheduleReconcileLastSentMonth: monthKey, scheduleReconcileEnabled: true },
        update: { scheduleReconcileLastSentMonth: monthKey },
      });
    }
    await logPackRun({
      monthKey,
      mode: options.mode,
      status: "sent",
      sent: result.sent,
      failed: result.failed,
      recipients: addresses,
      error: result.failed > 0 ? result.lastError : null,
      userId,
    });
    await createAuditLog({
      userId,
      actionType: options.mode === "resend" ? "report.pack_resent" : "report.monthly_reconcile_email",
      notes: `${options.mode === "resend" ? "Finance pack resent" : "Finance pack emailed"} — ${reportMonth.monthEndingLabel} (${result.sent} sent, ${result.failed} failed)`,
      metadata: {
        mode: options.mode,
        monthKey,
        official: true,
        stored: true,
        sent: result.sent,
        failed: result.failed,
        recipients: addresses,
      },
    });
    invalidateReportPeriods();
    return {
      ok: true,
      monthKey,
      monthLabel,
      sent: result.sent,
      failed: result.failed,
      error: result.failed > 0 ? result.lastError ?? undefined : undefined,
    };
  } catch (e) {
    console.error("runOfficialPack", e);
    const message = e instanceof Error ? e.message : "Failed to build or send the finance pack";
    await logPackRun({ monthKey, mode: options.mode, status: "failed", error: message, userId });
    await createAuditLog({
      userId,
      actionType: "report.pack_send_failed",
      notes: `Finance pack failed — ${reportMonth.monthEndingLabel}: ${message}`,
      metadata: { monthKey, mode: options.mode },
    });
    return { ok: false, monthKey, monthLabel, error: message };
  }
}

/**
 * Settings "send test": emails the current month's reconcile and breakdown. Not stored,
 * never the official file. The scheduled run goes through `runOfficialPack`.
 */
export async function sendMonthlyReconcileReport(options: {
  mode: MonthlyReconcileSendMode;
  userId?: string | null;
  force?: boolean;
}): Promise<MonthlyReconcileSendResult> {
  if (options.mode === "cron") return runOfficialPack({ mode: "cron", userId: options.userId });

  const settings = await getEmailNotificationSettings();
  const now = new Date();
  const reportMonth = reconcileReportMonth("manual_test", now);
  const { monthKey, monthLabel } = reportMonth;
  if (!options.force && !settings.scheduleReconcileEnabled) {
    return { ok: true, skipped: "schedule_disabled", monthKey, monthLabel };
  }
  const recipients = settings.financeRecipients;
  if (recipients.length === 0) {
    return { ok: false, skipped: "no_finance_emails", monthKey, monthLabel, error: "No finance emails configured." };
  }
  const sender = isSenderConfiguredForTransport(settings);
  if (!sender.ok) return { ok: false, error: `Sender not ready: ${sender.reason}`, monthKey, monthLabel };
  if (!settings.fromAddress.includes("@")) {
    return { ok: false, error: "From email not configured in environment.", monthKey, monthLabel };
  }

  try {
    const pdf = await buildReconcilePdfs("manual_test", now);
    const result = await sendPersonalizedFinanceEmails(
      settings,
      recipients,
      (greeting) =>
        buildMonthlyReconcileEmail({
          greeting,
          monthLabel: pdf.monthLabel,
          monthEndingLabel: pdf.monthEndingLabel,
          appUrl: appBaseUrl(),
          includeMonthOnMonth: false,
          includeYearly: false,
        }),
      {
        attachments: [
          { filename: `hna-monthly-stock-reconcile-${pdf.monthKey}.pdf`, content: pdf.reconcileBuffer, contentType: "application/pdf" },
          { filename: `hna-stock-breakdown-${pdf.monthKey}.pdf`, content: pdf.breakdownBuffer, contentType: "application/pdf" },
        ],
        monthLabel: pdf.monthLabel,
      }
    );
    await logPackRun({
      monthKey,
      mode: "manual_test",
      status: result.sent > 0 ? "sent" : "failed",
      sent: result.sent,
      failed: result.failed,
      recipients: recipients.map((r) => r.email),
      error: result.lastError,
      userId: options.userId,
    });
    await createAuditLog({
      userId: options.userId ?? null,
      actionType: "report.monthly_reconcile_email",
      notes: `Test reconcile emailed — ${pdf.monthEndingLabel} (${result.sent} sent, ${result.failed} failed). Not stored.`,
      metadata: { mode: "manual_test", monthKey, official: false, stored: false, sent: result.sent, failed: result.failed },
    });
    if (result.sent === 0) {
      return { ok: false, monthKey, monthLabel, sent: 0, failed: result.failed, error: result.lastError ?? "All sends failed" };
    }
    return { ok: true, monthKey, monthLabel, sent: result.sent, failed: result.failed };
  } catch (e) {
    console.error("sendMonthlyReconcileReport", e);
    return { ok: false, monthKey, monthLabel, error: e instanceof Error ? e.message : "Failed to send reconcile report" };
  }
}
