import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  composeLegacyColumns,
  draftFromStoredReport,
  monthKeyLabel,
  summarizeLegacyLines,
  type LegacyMonthEndLine,
} from "@/lib/reports/legacy-month-end";
import { buildMonthOnMonthAudit } from "@/lib/reports/month-on-month-audit";

/** Prior-company counts change only when an import script is run, so an hour is short enough. */
const OPTIONS = { tags: ["legacy-month-end"], revalidate: 3600 };

export const loadLegacyMonthEndList = unstable_cache(
  async () => {
    const reports = await prisma.monthEndStockReport.findMany({
      orderBy: { monthKey: "asc" },
      include: { lines: true },
    });
    return reports.map((report) => {
      const lines = report.lines as LegacyMonthEndLine[];
      return {
        monthKey: report.monthKey,
        label: monthKeyLabel(report.monthKey),
        sourceKind: report.sourceKind,
        sourceFileName: report.sourceFileName,
        carriedForwardFromMonthKey: report.carriedForwardFromMonthKey,
        ...summarizeLegacyLines(lines),
        composition: composeLegacyColumns(lines),
      };
    });
  },
  ["legacy-month-end-list-v1"],
  OPTIONS
);

export const loadMonthOnMonthAudit = unstable_cache(
  async () => {
    const reports = await prisma.monthEndStockReport.findMany({
      orderBy: { monthKey: "asc" },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    return buildMonthOnMonthAudit(
      reports.map((report) => draftFromStoredReport({ ...report, lines: report.lines as LegacyMonthEndLine[] }))
    );
  },
  ["month-on-month-audit-v1"],
  OPTIONS
);
