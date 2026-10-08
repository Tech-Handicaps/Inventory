import type { FinancePackSnapshot } from "@/lib/reports/finance-month-pack";

export const FINANCE_MONTH_ON_MONTH_COLUMNS = [
  "New stock",
  "Refurbished",
  "Usable",
  "Deployed",
  "Assessment",
  "In repairs",
  "Written off",
  "Register",
  "Usable vs previous stored",
  "Register vs previous stored",
] as const;

const STATUS_LABEL: Record<string, string> = {
  new_stock: "New stock",
  refurbished: "Refurbished",
  written_off: "Written off",
};

const STATUS_ORDER = ["new_stock", "refurbished", "written_off"];

export type FinanceMonthPosition = {
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
  lines: { statusCode: string; makeModel: string; count: number }[];
};

export type FinanceMonthOnMonthRow = {
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
  usableChange: number | null;
  registerChange: number | null;
};

export type FinanceModelMovement = {
  monthKey: string;
  monthEndingLabel: string;
  statusCode: string;
  statusLabel: string;
  makeModel: string;
  previous: number;
  current: number;
  delta: number;
};

export type FinanceMonthOnMonthReport = {
  introduction: string[];
  movementNote: string;
  months: FinanceMonthOnMonthRow[];
  movements: FinanceModelMovement[];
};

export function formatFinanceChange(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function financePositionFromSnapshot(
  monthKey: string,
  monthEndingLabel: string,
  snapshot: FinancePackSnapshot
): FinanceMonthPosition {
  return {
    monthKey,
    monthEndingLabel,
    ...snapshot.totals,
    lines: snapshot.lines.map((line) => ({
      statusCode: line.statusCode,
      makeModel: line.makeModel,
      count: line.count,
    })),
  };
}

function lineKey(statusCode: string, makeModel: string): string {
  return `${statusCode}\u0000${makeModel}`;
}

function lineMap(position: FinanceMonthPosition): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of position.lines) {
    map.set(lineKey(line.statusCode, line.makeModel), line.count);
  }
  return map;
}

function statusRank(statusCode: string): number {
  const index = STATUS_ORDER.indexOf(statusCode);
  return index === -1 ? STATUS_ORDER.length : index;
}

/**
 * Landscape of official finance months only. Months that were never stored
 * are left out. The first stored month has no change.
 */
export function buildFinanceMonthOnMonth(
  positions: FinanceMonthPosition[]
): FinanceMonthOnMonthReport {
  const ordered = [...positions].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const months: FinanceMonthPosition[] = [];
  const seen = new Set<string>();
  for (const position of ordered) {
    if (seen.has(position.monthKey)) continue;
    seen.add(position.monthKey);
    months.push(position);
  }

  const introduction = [
    "Prior-company quantities for October 2025 through March 2026 are on the prior-company month-on-month report. The handover is the join between that series and this register. The totals are not added.",
    "This landscape lists only official finance packs that were emailed and kept. A month that was never stored is left out. Change is this position minus the previous stored position. Usable stock is new stock plus refurbished.",
  ];
  if (months.length === 0) {
    introduction.push(
      "No official finance pack has been kept yet. The series starts at the first scheduled send that reaches finance."
    );
  } else {
    introduction.push(`The series starts at ${months[0].monthEndingLabel}.`);
  }

  const rows: FinanceMonthOnMonthRow[] = months.map((month, index) => {
    const previous = index === 0 ? null : months[index - 1];
    return {
      monthKey: month.monthKey,
      monthEndingLabel: month.monthEndingLabel,
      newStock: month.newStock,
      refurbished: month.refurbished,
      usable: month.usable,
      deployed: month.deployed,
      assessment: month.assessment,
      inRepair: month.inRepair,
      writtenOff: month.writtenOff,
      register: month.register,
      usableChange: previous ? month.usable - previous.usable : null,
      registerChange: previous ? month.register - previous.register : null,
    };
  });

  const movements: FinanceModelMovement[] = [];
  for (let index = 1; index < months.length; index += 1) {
    const current = months[index];
    const previous = months[index - 1];
    const previousCounts = lineMap(previous);
    const currentCounts = lineMap(current);
    const keys = new Set([...previousCounts.keys(), ...currentCounts.keys()]);
    const changed: FinanceModelMovement[] = [];
    for (const key of keys) {
      const splitAt = key.indexOf("\u0000");
      const statusCode = key.slice(0, splitAt);
      const makeModel = key.slice(splitAt + 1);
      const before = previousCounts.get(key) ?? 0;
      const after = currentCounts.get(key) ?? 0;
      if (before === after) continue;
      changed.push({
        monthKey: current.monthKey,
        monthEndingLabel: current.monthEndingLabel,
        statusCode,
        statusLabel: STATUS_LABEL[statusCode] ?? statusCode,
        makeModel,
        previous: before,
        current: after,
        delta: after - before,
      });
    }
    changed.sort((a, b) => {
      const byStatus = statusRank(a.statusCode) - statusRank(b.statusCode);
      if (byStatus !== 0) return byStatus;
      return a.makeModel.localeCompare(b.makeModel);
    });
    movements.push(...changed);
  }

  return {
    introduction,
    movementNote:
      "Make and model changes cover new stock, refurbished, and written off. Those are the counts kept with each pack. Deployed serials stay on that month's stock breakdown.",
    months: rows,
    movements,
  };
}
