import {
  composeLegacyColumns,
  monthKeyLabel,
  summarizeLegacyLines,
  type LegacyColumnComposition,
  type LegacyMonthEndDraft,
  type LegacyMonthTotals,
} from "@/lib/reports/legacy-month-end";

const QTY_FIELDS = [
  ["newStock", "New"],
  ["repairedUsed", "Repaired/Used"],
  ["toAssess", "To assess"],
  ["toDispose", "To dispose"],
  ["warrantyRepair", "Warranty"],
] as const;

export type MonthOnMonthDelta = {
  newStock: number;
  repairedUsed: number;
  toAssess: number;
  toDispose: number;
  warrantyRepair: number;
  usable: number;
  units: number;
};

export type MonthOnMonthSourceKind = LegacyMonthEndDraft["sourceKind"];

export type MonthOnMonthTotals = LegacyMonthTotals & {
  /** Null on prior-company rows. The workbook did not count field units. */
  deployed: number | null;
  /** Null on prior-company rows. Live In Repairs is not the workbook warranty column. */
  inRepair: number | null;
};

/** Current serialised register, counted in Africa/Johannesburg's calendar month. */
export type LiveMonthInput = {
  monthKey: string;
  asOfLabel: string;
  newStock: number;
  refurbished: number;
  deployed: number;
  assessment: number;
  repair: number;
  writtenOff: number;
  /** Statuses outside the six lifecycle codes. Still counted in units. */
  other: number;
};

export type MonthOnMonthRow = {
  monthKey: string;
  label: string;
  sourceKind: MonthOnMonthSourceKind;
  sourceLabel: string;
  totals: MonthOnMonthTotals;
  /** Null on the opening month and on the live register row. */
  delta: MonthOnMonthDelta | null;
  movementNote: string;
};

export type LineMovement = {
  toMonthKey: string;
  toLabel: string;
  manufacturer: string;
  model: string;
  category: string;
  column: string;
  previous: number;
  current: number;
  delta: number;
};

export type MonthStockBreakdown = {
  monthKey: string;
  label: string;
  columns: LegacyColumnComposition[];
};

export type MonthOnMonthAudit = {
  months: MonthOnMonthRow[];
  movements: LineMovement[];
  explanation: string[];
  /** Workbook months whose make-up differs from the previous month. */
  stockBreakdowns: MonthStockBreakdown[];
};

export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function deltaBetween(
  current: LegacyMonthTotals,
  previous: LegacyMonthTotals
): MonthOnMonthDelta {
  return {
    newStock: current.newStock - previous.newStock,
    repairedUsed: current.repairedUsed - previous.repairedUsed,
    toAssess: current.toAssess - previous.toAssess,
    toDispose: current.toDispose - previous.toDispose,
    warrantyRepair: current.warrantyRepair - previous.warrantyRepair,
    usable: current.usable - previous.usable,
    units: current.units - previous.units,
  };
}

function sourceLabel(draft: LegacyMonthEndDraft): string {
  if (draft.sourceKind === "source_file") return "Workbook";
  const from = draft.carriedForwardFromMonthKey
    ? monthKeyLabel(draft.carriedForwardFromMonthKey)
    : "the previous workbook";
  return `Copied from ${from}`;
}

function movementNote(
  draft: LegacyMonthEndDraft,
  delta: MonthOnMonthDelta | null
): string {
  if (!delta) return "Opening stock take.";
  if (draft.sourceKind === "carried_forward") {
    return "Copied from December 2025, so the quantities do not change.";
  }
  const parts = QTY_FIELDS.filter(([field]) => delta[field] !== 0).map(
    ([field, label]) => `${label} ${formatSigned(delta[field])}`
  );
  if (parts.length === 0) return "No change from the previous month.";
  return `${parts.join("; ")}.`;
}

function lineMovements(
  previous: LegacyMonthEndDraft,
  current: LegacyMonthEndDraft
): LineMovement[] {
  const priorByOrder = new Map(
    previous.lines.map((line) => [line.sortOrder, line])
  );
  const movements: LineMovement[] = [];
  for (const line of current.lines) {
    const before = priorByOrder.get(line.sortOrder);
    for (const [field, column] of QTY_FIELDS) {
      const previousQty = before ? before[field] : 0;
      const currentQty = line[field];
      const delta = currentQty - previousQty;
      if (delta === 0) continue;
      movements.push({
        toMonthKey: current.monthKey,
        toLabel: monthKeyLabel(current.monthKey),
        manufacturer: line.manufacturer,
        model: line.model,
        category: line.category,
        column,
        previous: previousQty,
        current: currentQty,
        delta,
      });
    }
  }
  return movements;
}

function describeMovements(movements: LineMovement[]): string {
  if (movements.length === 0) {
    return "No make or model changed quantity from one prior-company month to the next.";
  }
  const bits = movements.map(
    (movement) =>
      `${movement.manufacturer} ${movement.model} (${movement.category}) ${movement.column} moved from ${movement.previous} to ${movement.current} (${formatSigned(movement.delta)}) in ${movement.toLabel}`
  );
  return `Inside the prior-company stock takes, the only line movements are: ${bits.join("; ")}.`;
}

const JOHANNESBURG = "Africa/Johannesburg";

export function liveMonthFromAssets(
  assets: { status: { code: string } }[],
  now = new Date()
): LiveMonthInput {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: JOHANNESBURG,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const counts = {
    newStock: 0,
    refurbished: 0,
    deployed: 0,
    assessment: 0,
    repair: 0,
    writtenOff: 0,
    other: 0,
  };
  for (const asset of assets) {
    const code = asset.status.code;
    if (code === "new_stock") counts.newStock += 1;
    else if (code === "refurbished") counts.refurbished += 1;
    else if (code === "deployed") counts.deployed += 1;
    else if (code === "assessment") counts.assessment += 1;
    else if (code === "repair") counts.repair += 1;
    else if (code === "written_off") counts.writtenOff += 1;
    else counts.other += 1;
  }
  return {
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    asOfLabel: new Intl.DateTimeFormat("en-ZA", {
      timeZone: JOHANNESBURG,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now),
    ...counts,
  };
}

function archiveTotals(totals: LegacyMonthTotals): MonthOnMonthTotals {
  return { ...totals, deployed: null, inRepair: null };
}

function explanationFor(
  months: MonthOnMonthRow[],
  movements: LineMovement[]
): string[] {
  const first = months[0];
  const last = months[months.length - 1];
  const span =
    first && last ? `${first.label} through ${last.label}` : "October 2025 through March 2026";

  return [
    `This landscape compares the prior-company stock takes from ${span}. It does not include the live register. This system's serialised assets are a separate series, starting from the first asset recorded on 18 April 2026.`,
    "October, November, and December 2025 come from the prior-company workbooks, sheet Actual. Those forms count units by make and model. They do not list serial numbers, so these months stay quantity records and are not rows on the hardware board.",
    "January, February, and March 2026 repeat the December 2025 count. No workbook was supplied for those months. The copy is there so accounts has a file for each of them. April 2026 is not a copy of December. The prior-company series stops at March.",
    "Usable stock is New plus Repaired/Used. To assess, to dispose, and warranty repair stay in their own columns. A blank cell on the workbook is zero.",
    describeMovements(movements),
    "Mecer UST-TP01 is listed and counted as zero. On the workbook its New, Repaired/Used, and To assess cells are formulas pointing at the Posiflex PS-3316E row, so those cells are not a second quantity.",
    "December matches November. January through March show no movement because they are copies of December.",
  ];
}

export function buildMonthOnMonthAudit(
  drafts: LegacyMonthEndDraft[]
): MonthOnMonthAudit {
  const ordered = [...drafts].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const months: MonthOnMonthRow[] = [];
  const movements: LineMovement[] = [];

  ordered.forEach((draft, index) => {
    const totals = summarizeLegacyLines(draft.lines);
    const previous = index > 0 ? ordered[index - 1] : null;
    const delta = previous
      ? deltaBetween(totals, summarizeLegacyLines(previous.lines))
      : null;
    if (previous) movements.push(...lineMovements(previous, draft));
    months.push({
      monthKey: draft.monthKey,
      label: monthKeyLabel(draft.monthKey),
      sourceKind: draft.sourceKind,
      sourceLabel: sourceLabel(draft),
      totals: archiveTotals(totals),
      delta,
      movementNote: movementNote(draft, delta),
    });
  });

  const stockBreakdowns: MonthStockBreakdown[] = [];
  let previousComposition = "";
  for (const draft of ordered) {
    const columns = composeLegacyColumns(draft.lines);
    const signature = JSON.stringify(columns);
    if (signature === previousComposition) continue;
    previousComposition = signature;
    stockBreakdowns.push({
      monthKey: draft.monthKey,
      label: monthKeyLabel(draft.monthKey),
      columns,
    });
  }

  return {
    months,
    movements,
    explanation: explanationFor(months, movements),
    stockBreakdowns,
  };
}
