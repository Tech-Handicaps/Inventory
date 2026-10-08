import type { LegacyMonthTotals } from "@/lib/reports/legacy-month-end";
import {
  buildFinanceMonthOnMonth,
  type FinanceMonthOnMonthRow,
  type FinanceMonthPosition,
} from "@/lib/reports/finance-month-on-month";

export type WorkbookYearBlock = {
  year: "2025";
  basis: string;
  monthKey: string;
  monthEndingLabel: string;
  sourceLabel: string;
  newStock: number;
  repairedUsed: number;
  usable: number;
  toAssess: number;
  toDispose: number;
  warrantyRepair: number;
  units: number;
};

export type FinanceYearClosing = {
  monthKey: string;
  monthEndingLabel: string;
  newStock: number;
  refurbished: number;
  usable: number;
  deployed: number;
  assessment: number;
  inRepair: number;
  writtenOff: number;
  register: number;
};

export type FinanceYearBlock = {
  year: "2026";
  closed: boolean;
  basis: string;
  closing: FinanceYearClosing | null;
  months: FinanceMonthOnMonthRow[];
};

export type FinanceYearlyReport = {
  introduction: string[];
  workbook2025: WorkbookYearBlock | null;
  finance2026: FinanceYearBlock;
};

export type DecemberWorkbookInput = {
  monthKey: string;
  sourceFileName: string | null;
  sourceKind: "source_file" | "carried_forward";
  totals: LegacyMonthTotals;
};

const WORKBOOK_BASIS =
  "Basis: the December 2025 workbook, sheet Actual. This is a quantity stock take. It is not a position on this system's register.";

function financeBasis(closing: FinanceYearClosing | null, closed: boolean): string {
  if (!closing) {
    return "Basis: the latest official finance pack kept for 2026. None has been kept yet. 2026 is not closed. July, August, and September 2026 were emailed and not kept, and they are not estimated here.";
  }
  if (closed) {
    return `Basis: ${closing.monthEndingLabel}, the closing official finance pack for 2026. This block is that register position. It is not subtracted from the 2025 workbook.`;
  }
  return `Basis: ${closing.monthEndingLabel}, the latest official finance pack kept for 2026. 2026 is not closed. This block is that register position. It is not subtracted from the 2025 workbook.`;
}

function closingFrom(row: FinanceMonthOnMonthRow): FinanceYearClosing {
  return {
    monthKey: row.monthKey,
    monthEndingLabel: row.monthEndingLabel,
    newStock: row.newStock,
    refurbished: row.refurbished,
    usable: row.usable,
    deployed: row.deployed,
    assessment: row.assessment,
    inRepair: row.inRepair,
    writtenOff: row.writtenOff,
    register: row.register,
  };
}

/**
 * Two year blocks. 2025 is the December workbook. 2026 is the latest stored
 * finance month of that year. The blocks are not subtracted.
 */
export function buildFinanceYearly(input: {
  december2025: DecemberWorkbookInput | null;
  financePositions: FinanceMonthPosition[];
}): FinanceYearlyReport {
  const december = input.december2025;
  const workbook2025: WorkbookYearBlock | null = december
    ? {
        year: "2025",
        basis: WORKBOOK_BASIS,
        monthKey: december.monthKey,
        monthEndingLabel: "For month ending December 2025",
        sourceLabel:
          december.sourceKind === "source_file"
            ? december.sourceFileName ?? "Workbook"
            : "Copied from December 2025",
        newStock: december.totals.newStock,
        repairedUsed: december.totals.repairedUsed,
        usable: december.totals.usable,
        toAssess: december.totals.toAssess,
        toDispose: december.totals.toDispose,
        warrantyRepair: december.totals.warrantyRepair,
        units: december.totals.units,
      }
    : null;

  const yearMonths = buildFinanceMonthOnMonth(
    input.financePositions.filter((position) => position.monthKey.startsWith("2026-"))
  ).months;
  const last = yearMonths[yearMonths.length - 1] ?? null;
  const closing = last ? closingFrom(last) : null;
  const closed = closing?.monthKey === "2026-12";

  const introduction = [
    "Each year is its own block. The blocks are not subtracted.",
    "2025 is the December 2025 prior-company workbook. October and November of that year stay on the prior-company month-on-month report.",
    "2026 is the latest official finance pack kept for that year. A month that was never stored is left out. The handover is the join between the two series.",
  ];
  if (!workbook2025) {
    introduction.push("The December 2025 workbook is not on file.");
  }

  return {
    introduction,
    workbook2025,
    finance2026: {
      year: "2026",
      closed,
      basis: financeBasis(closing, closed),
      closing,
      months: yearMonths,
    },
  };
}
