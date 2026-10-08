import { prisma } from "@/lib/prisma";
import type { FinanceMonthPosition } from "@/lib/reports/finance-month-on-month";
import type { DecemberWorkbookInput } from "@/lib/reports/finance-yearly";
import {
  draftFromStoredReport,
  summarizeLegacyLines,
  type LegacyMonthEndLine,
} from "@/lib/reports/legacy-month-end";

export async function loadStoredFinancePositions(): Promise<FinanceMonthPosition[]> {
  const packs = await prisma.financeMonthPack.findMany({
    orderBy: { monthKey: "asc" },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  return packs.map((pack) => ({
    monthKey: pack.monthKey,
    monthEndingLabel: pack.monthEndingLabel,
    newStock: pack.newStock,
    refurbished: pack.refurbished,
    usable: pack.usable,
    deployed: pack.deployed,
    assessment: pack.assessment,
    inRepair: pack.inRepair,
    writtenOff: pack.writtenOff,
    register: pack.register,
    lines: pack.lines.map((line) => ({
      statusCode: line.statusCode,
      makeModel: line.makeModel,
      count: line.count,
    })),
  }));
}

export async function loadDecember2025Workbook(): Promise<DecemberWorkbookInput | null> {
  const report = await prisma.monthEndStockReport.findUnique({
    where: { monthKey: "2025-12" },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!report) return null;
  const draft = draftFromStoredReport({
    ...report,
    lines: report.lines as LegacyMonthEndLine[],
  });
  return {
    monthKey: draft.monthKey,
    sourceFileName: draft.sourceFileName,
    sourceKind: draft.sourceKind,
    totals: summarizeLegacyLines(draft.lines),
  };
}
