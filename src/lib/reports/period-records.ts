import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  summarizeLegacyLines,
  type LegacyMonthEndLine,
  type LegacyMonthTotals,
} from "@/lib/reports/legacy-month-end";
import {
  periodsThrough,
  previousMonthKey,
  sastMonthKey,
  type PeriodInfo,
} from "@/lib/reports/period-catalog";
import { PERIOD_DOCUMENT_KINDS, type PeriodDocumentKind } from "@/lib/reports/period-documents";

export const REPORT_PERIODS_TAG = "report-periods";

export type PeriodDocumentRow = {
  id: string;
  kind: string;
  kindLabel: string;
  title: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  flag: string | null;
  notes: string | null;
  documentDate: string | null;
  uploadedAt: string;
};

export type PriorEventRow = {
  id: string;
  eventDate: string;
  documentDate: string | null;
  eventType: string;
  description: string;
  assetLabel: string;
  serials: string[];
  fromLocation: string;
  toLocation: string;
  reference: string;
  crmReference: string | null;
  waybill: string | null;
  condition: string | null;
  evidenceFileName: string;
  evidenceDocumentId: string | null;
  assetId: string | null;
  notes: string | null;
};

export type InconsistencyRow = {
  id: string;
  key: string;
  monthKey: string | null;
  title: string;
  detail: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
};

export type HandoverRow = {
  monthKey: string;
  receivedOn: string | null;
  fromParty: string;
  receivedBy: string | null;
  reference: string | null;
  basis: string;
  notes: string | null;
  updatedAt: string;
};

export type PeriodRow = PeriodInfo & {
  /** Stored prior-company quantities (null when this month has none). */
  totals: LegacyMonthTotals | null;
  /** Memo line quantity, e.g. the dongle line (shown, never counted). */
  memoUnits: number | null;
  hasStoredReport: boolean;
  sourceFileName: string | null;
  pack: { sentAt: string; register: number; recipientCount: number } | null;
  documents: PeriodDocumentRow[];
  events: PriorEventRow[];
  openFlags: number;
};

export type PeriodsOverview = {
  periods: PeriodRow[];
  handover: HandoverRow | null;
  inconsistencies: InconsistencyRow[];
};

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toEventRow(event: {
  id: string;
  eventDate: Date;
  documentDate: Date | null;
  eventType: string;
  description: string;
  assetLabel: string;
  serials: string[];
  fromLocation: string;
  toLocation: string;
  reference: string;
  crmReference: string | null;
  waybill: string | null;
  condition: string | null;
  evidenceFileName: string;
  evidenceDocumentId: string | null;
  assetId: string | null;
  notes: string | null;
}): PriorEventRow {
  return {
    ...event,
    eventDate: dateOnly(event.eventDate) ?? "",
    documentDate: dateOnly(event.documentDate),
  };
}

export function toDocumentRow(doc: {
  id: string;
  kind: string;
  title: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  flag: string | null;
  notes: string | null;
  documentDate: Date | null;
  uploadedAt: Date;
}): PeriodDocumentRow {
  return {
    id: doc.id,
    kind: doc.kind,
    kindLabel: PERIOD_DOCUMENT_KINDS[doc.kind as PeriodDocumentKind] ?? doc.kind,
    title: doc.title,
    fileName: doc.fileName,
    sha256: doc.sha256,
    sizeBytes: doc.sizeBytes,
    flag: doc.flag,
    notes: doc.notes,
    documentDate: dateOnly(doc.documentDate),
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

async function computePeriodsOverview(lastMonthKey: string): Promise<PeriodsOverview> {
  const [reports, documents, events, packs, flags, handover] = await Promise.all([
    prisma.monthEndStockReport.findMany({ include: { lines: true } }),
    prisma.periodDocument.findMany({ orderBy: [{ monthKey: "asc" }, { uploadedAt: "asc" }] }),
    prisma.priorCompanyEvent.findMany({ orderBy: [{ eventDate: "asc" }, { reference: "asc" }] }),
    prisma.financeMonthPack.findMany({
      select: { monthKey: true, sentAt: true, register: true, recipientCount: true },
    }),
    prisma.dataInconsistency.findMany({ orderBy: [{ monthKey: "asc" }, { createdAt: "asc" }] }),
    prisma.handoverRecord.findUnique({ where: { monthKey: "2026-05" } }),
  ]);

  const reportByMonth = new Map(reports.map((report) => [report.monthKey, report]));
  const packByMonth = new Map(packs.map((pack) => [pack.monthKey, pack]));

  const periods = periodsThrough(lastMonthKey).map((info): PeriodRow => {
    const report = reportByMonth.get(info.monthKey);
    const memo = report?.lines.filter((line) => line.memo) ?? [];
    const pack = packByMonth.get(info.monthKey);
    return {
      ...info,
      totals: report ? summarizeLegacyLines(report.lines as LegacyMonthEndLine[]) : null,
      memoUnits: memo.length
        ? memo.reduce((sum, line) => sum + line.newStock + line.repairedUsed + line.toAssess, 0)
        : null,
      hasStoredReport: Boolean(report),
      sourceFileName: report?.sourceFileName ?? null,
      pack: pack
        ? { sentAt: pack.sentAt.toISOString(), register: pack.register, recipientCount: pack.recipientCount }
        : null,
      documents: documents.filter((doc) => doc.monthKey === info.monthKey).map(toDocumentRow),
      events: events
        .filter((event) => event.eventDate.toISOString().slice(0, 7) === info.monthKey)
        .map(toEventRow),
      openFlags: flags.filter((flag) => flag.monthKey === info.monthKey && flag.status === "open").length,
    };
  });

  return {
    periods: periods.reverse(),
    handover: handover
      ? {
          monthKey: handover.monthKey,
          receivedOn: dateOnly(handover.receivedOn),
          fromParty: handover.fromParty,
          receivedBy: handover.receivedBy,
          reference: handover.reference,
          basis: handover.basis,
          notes: handover.notes,
          updatedAt: handover.updatedAt.toISOString(),
        }
      : null,
    inconsistencies: flags.map((flag) => ({
      id: flag.id,
      key: flag.key,
      monthKey: flag.monthKey,
      title: flag.title,
      detail: flag.detail,
      status: flag.status,
      resolution: flag.resolution,
      resolvedAt: iso(flag.resolvedAt),
    })),
  };
}

const cachedOverview = unstable_cache(computePeriodsOverview, ["report-periods-v1"], {
  tags: [REPORT_PERIODS_TAG],
  revalidate: 300,
});

/** Every period from Oct 2025 through last month (SAST), newest first. */
export function loadPeriodsOverview(now = new Date()): Promise<PeriodsOverview> {
  return cachedOverview(previousMonthKey(sastMonthKey(now)));
}

export function invalidateReportPeriods() {
  try {
    revalidateTag(REPORT_PERIODS_TAG, { expire: 0 });
  } catch {
    /* outside a request */
  }
}
