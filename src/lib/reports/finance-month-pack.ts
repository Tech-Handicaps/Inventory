import type {
  StockBreakdownReport,
  StockReconcileReport,
} from "@/lib/reports/stock-reconcile";

export const FINANCE_PACK_BUCKET = "finance-packs";

export type FinancePackTotals = {
  newStock: number;
  refurbished: number;
  usable: number;
  deployed: number;
  assessment: number;
  inRepair: number;
  writtenOff: number;
  register: number;
};

export type FinancePackModelCount = {
  statusCode: string;
  makeModel: string;
  count: number;
  sortOrder: number;
};

export type FinancePackSnapshot = {
  totals: FinancePackTotals;
  lines: FinancePackModelCount[];
};

export function financePackStoragePath(
  monthKey: string,
  kind: "reconcile" | "breakdown" | "month-on-month" | "yearly"
): string {
  const file =
    kind === "reconcile"
      ? "hna-monthly-stock-reconcile.pdf"
      : kind === "breakdown"
        ? "hna-stock-breakdown.pdf"
        : kind === "month-on-month"
          ? "hna-finance-month-on-month.pdf"
          : "hna-finance-yearly.pdf";
  return `${monthKey}/${file}`;
}

/**
 * Keep the pack only after a scheduled send reached at least one recipient,
 * and only when that report month is not already stored.
 */
export function shouldKeepOfficialPack(input: {
  mode: "cron" | "manual_test";
  sent: number;
  alreadyKept: boolean;
}): boolean {
  return input.mode === "cron" && input.sent > 0 && !input.alreadyKept;
}

export function financePackSnapshot(
  reconcile: StockReconcileReport,
  breakdown: StockBreakdownReport
): FinancePackSnapshot {
  const totals = reconcile.fullStatusGrandTotal;
  const lines: FinancePackModelCount[] = [];
  let sortOrder = 0;
  for (const section of breakdown.sections) {
    for (const model of section.models) {
      lines.push({
        statusCode: section.statusCode,
        makeModel: model.makeModel,
        count: model.count,
        sortOrder,
      });
      sortOrder += 1;
    }
  }
  return {
    totals: {
      newStock: totals.newStock,
      refurbished: totals.refurbished,
      usable: totals.totalStock,
      deployed: totals.deployed,
      assessment: totals.assessment,
      inRepair: totals.repair,
      writtenOff: totals.writtenOff,
      register: totals.grandTotal,
    },
    lines,
  };
}
