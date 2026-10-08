import { classifyReportAssetType } from "@/lib/reports/asset-types";
import {
  LEGACY_STOCK_SKUS,
  type LegacySku,
} from "@/lib/reports/legacy-month-end-catalog";

export type LegacyQty = {
  newStock?: number;
  repairedUsed?: number;
  toAssess?: number;
  toDispose?: number;
  warrantyRepair?: number;
};

/** Non-zero cells from sheet Actual. Blank cells on the workbook are zero. */
const OCTOBER_2025: Record<string, LegacyQty> = {
  "mecer-x22s": { toAssess: 1 },
  "dell-optiplex-3050": { toAssess: 1 },
  "hp-compaq-8300": { repairedUsed: 3 },
  "dell-optiplex-7440": { toAssess: 1 },
  "posiflex-ps-3316e": { newStock: 11 },
  "mecer-le22bw": { toAssess: 1 },
  "intel-boxstk1aw32sc": { newStock: 1 },
  "intel-nuc7cjyh": { repairedUsed: 1, toAssess: 1 },
  "huawei-e3131": { toAssess: 1 },
  "vodafone-k3565-rev-2": { repairedUsed: 16, toAssess: 22 },
  "vodafone-k3565-z": { repairedUsed: 1 },
  "vodafone-k3772-z": { repairedUsed: 1, toAssess: 1 },
  "huawei-e153": { repairedUsed: 1 },
  "vodafone-k3520": { toAssess: 1 },
  "vodafone-k4607-z": { toAssess: 1 },
  "huawei-e220": { repairedUsed: 1 },
  "huawei-e160g": { toAssess: 1 },
  "dlink-dwr-932m": { toAssess: 3 },
  "vodafone-r219h": { toAssess: 5 },
  "vodafone-r219z": { newStock: 2 },
  "magtek-21040108": { repairedUsed: 1, toAssess: 5 },
  "gigatek-msr250hk": { newStock: 7, repairedUsed: 1, toAssess: 4 },
  "partner-msr213u": { toAssess: 2 },
  "mecer-card-reader-bracket": { newStock: 32 },
  "mecer-ust-tp01": { newStock: 11 },
};

/** November changes against October. December matches November. */
const NOVEMBER_2025: Record<string, LegacyQty> = {
  ...OCTOBER_2025,
  "dell-optiplex-7440": { toAssess: 2 },
  "posiflex-ps-3316e": { newStock: 11, toAssess: 1 },
  "mecer-ust-tp01": { newStock: 11, toAssess: 1 },
};

const SOURCE_MONTHS: {
  monthKey: string;
  fileName: string;
  qty: Record<string, LegacyQty>;
}[] = [
  {
    monthKey: "2025-10",
    fileName: "Month End Stock Take 20251031.xlsx",
    qty: OCTOBER_2025,
  },
  {
    monthKey: "2025-11",
    fileName: "Month End Stock Take 20251130.xlsx",
    qty: NOVEMBER_2025,
  },
  {
    monthKey: "2025-12",
    fileName: "Month End Stock Take 20251231.xlsx",
    qty: NOVEMBER_2025,
  },
];

/** Months with no workbook. Counts repeat the December 2025 take. */
export const CARRIED_FORWARD_MONTHS = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
] as const;

const CARRIED_FROM = "2025-12";

export type LegacyMonthEndLine = {
  sortOrder: number;
  groupLabel: string;
  manufacturer: string;
  model: string;
  category: string;
  tags: string[];
  financeType: string;
  typeNotes: string;
  newStock: number;
  repairedUsed: number;
  toAssess: number;
  toDispose: number;
  warrantyRepair: number;
  lineNotes: string | null;
};

export type LegacyMonthEndDraft = {
  monthKey: string;
  periodEnding: Date;
  sourceKind: "source_file" | "carried_forward";
  sourceFileName: string | null;
  carriedForwardFromMonthKey: string | null;
  notes: string;
  lines: LegacyMonthEndLine[];
};

export function monthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthKeyPeriodEnding(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}

function n(value: number | undefined): number {
  return value ?? 0;
}

function lineFromSku(sku: LegacySku, index: number, qty: LegacyQty | undefined): LegacyMonthEndLine {
  return {
    sortOrder: index,
    groupLabel: sku.groupLabel,
    manufacturer: sku.manufacturer,
    model: sku.model,
    category: sku.category,
    tags: sku.tags,
    financeType: classifyReportAssetType(sku.category, sku.tags),
    typeNotes: sku.typeNotes,
    newStock: n(qty?.newStock),
    repairedUsed: n(qty?.repairedUsed),
    toAssess: n(qty?.toAssess),
    toDispose: n(qty?.toDispose),
    warrantyRepair: n(qty?.warrantyRepair),
    lineNotes: sku.lineNotes ?? null,
  };
}

function linesFor(qty: Record<string, LegacyQty>): LegacyMonthEndLine[] {
  return LEGACY_STOCK_SKUS.map((sku, index) =>
    lineFromSku(sku, index, qty[sku.key])
  );
}

const SOURCE_NOTE =
  "Imported from the prior-company workbook, sheet Actual. The second sheet was an old in-house template with no month-end quantities and was not imported. The workbook has no serial numbers, so this is a quantity record only and is not on the live hardware board.";

const CARRIED_NOTE =
  "No stock-take workbook was supplied for this month. Quantities are copied from the December 2025 prior-company stock take so accounts has a report for each month through May 2026, when this system started capturing stock. This is not the live register.";

export function buildLegacyMonthEndDrafts(): LegacyMonthEndDraft[] {
  const sourced = SOURCE_MONTHS.map((month) => ({
    monthKey: month.monthKey,
    periodEnding: monthKeyPeriodEnding(month.monthKey),
    sourceKind: "source_file" as const,
    sourceFileName: month.fileName,
    carriedForwardFromMonthKey: null,
    notes: SOURCE_NOTE,
    lines: linesFor(month.qty),
  }));

  const december = SOURCE_MONTHS.find((month) => month.monthKey === CARRIED_FROM);
  if (!december) {
    throw new Error("December 2025 source month is missing");
  }

  const carried = CARRIED_FORWARD_MONTHS.map((monthKey) => ({
    monthKey,
    periodEnding: monthKeyPeriodEnding(monthKey),
    sourceKind: "carried_forward" as const,
    sourceFileName: null,
    carriedForwardFromMonthKey: CARRIED_FROM,
    notes: CARRIED_NOTE,
    lines: linesFor(december.qty),
  }));

  return [...sourced, ...carried];
}

export function legacyLineUnits(line: {
  newStock: number;
  repairedUsed: number;
  toAssess: number;
  toDispose: number;
  warrantyRepair: number;
}): number {
  return (
    line.newStock +
    line.repairedUsed +
    line.toAssess +
    line.toDispose +
    line.warrantyRepair
  );
}

export type LegacyMonthTotals = {
  newStock: number;
  repairedUsed: number;
  toAssess: number;
  toDispose: number;
  warrantyRepair: number;
  /** New stock + repaired/used. Matches the workbook "Usable Total". */
  usable: number;
  /** Usable + to assess. Matches the workbook "Potential Usable Total". */
  potentialUsable: number;
  units: number;
};

export function draftFromStoredReport(report: {
  monthKey: string;
  periodEnding: Date;
  sourceKind: string;
  sourceFileName: string | null;
  carriedForwardFromMonthKey: string | null;
  notes: string | null;
  lines: LegacyMonthEndLine[];
}): LegacyMonthEndDraft {
  const sourceKind =
    report.sourceKind === "carried_forward" ? "carried_forward" : "source_file";
  return {
    monthKey: report.monthKey,
    periodEnding: report.periodEnding,
    sourceKind,
    sourceFileName: report.sourceFileName,
    carriedForwardFromMonthKey: report.carriedForwardFromMonthKey,
    notes: report.notes ?? "",
    lines: [...report.lines].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function summarizeLegacyLines(
  lines: LegacyMonthEndLine[]
): LegacyMonthTotals {
  const totals = lines.reduce(
    (acc, line) => {
      acc.newStock += line.newStock;
      acc.repairedUsed += line.repairedUsed;
      acc.toAssess += line.toAssess;
      acc.toDispose += line.toDispose;
      acc.warrantyRepair += line.warrantyRepair;
      return acc;
    },
    {
      newStock: 0,
      repairedUsed: 0,
      toAssess: 0,
      toDispose: 0,
      warrantyRepair: 0,
    }
  );
  const usable = totals.newStock + totals.repairedUsed;
  return {
    ...totals,
    usable,
    potentialUsable: usable + totals.toAssess,
    units:
      usable + totals.toAssess + totals.toDispose + totals.warrantyRepair,
  };
}
