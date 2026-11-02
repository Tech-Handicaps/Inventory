/**
 * What each report month is, and how it must be labelled (spec 5.3).
 * Months before October 2026 print the Notes for auditors and finance as page 1.
 */

export type PeriodKind =
  | "prior_count"
  | "albatros_no_count"
  | "handover"
  | "no_count"
  | "emailed_not_stored"
  | "system_pack";

export type PeriodInfo = {
  monthKey: string;
  monthLabel: string;
  kind: PeriodKind;
  title: string;
  detail: string | null;
  /** Printed across every page of the PDF. Null for real counts and system packs. */
  watermark: string | null;
  /** Month whose quantities are shown, when there was no count in this month. */
  carriedFromMonthKey: string | null;
  /** True only for a real count taken at the month-end. */
  isMonthEndCount: boolean;
  notesFirst: boolean;
};

export const FIRST_PERIOD = "2025-10";
export const FIRST_SYSTEM_PACK_MONTH = "2026-10";
export const LAST_PRIOR_COUNT = "2026-01";

const SYSTEM_START_NOTE =
  "This system recorded its first asset on 18 Apr 2026 (system start-up); loading ran until 13 Aug 2026.";

export function monthLabelOf(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** The calendar month in Africa/Johannesburg, `YYYY-MM`. */
export function sastMonthKey(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}`;
}

export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function notesFirstFor(monthKey: string): boolean {
  return monthKey < FIRST_SYSTEM_PACK_MONTH;
}

/** True when any month in the list needs the Notes page in front. */
export function anyNotesFirst(monthKeys: string[]): boolean {
  return monthKeys.some(notesFirstFor);
}

type Spec = Omit<PeriodInfo, "monthKey" | "monthLabel" | "notesFirst">;

function priorCount(title: string, detail: string | null): Spec {
  return {
    kind: "prior_count",
    title,
    detail,
    watermark: null,
    carriedFromMonthKey: null,
    isMonthEndCount: true,
  };
}

const ALBATROS_NO_COUNT: Spec = {
  kind: "albatros_no_count",
  title:
    "Stock held by Albatros – no count or reporting provided – carried forward from 31 Jan 2026 count",
  detail: `The technical side moved from Albatros to HNA in Feb 2026. Albatros kept holding the stock but provided no counts or reporting. This is not a month-end count. ${SYSTEM_START_NOTE}`,
  watermark: "Stock held by Albatros – carried forward from 31 Jan 2026",
  carriedFromMonthKey: LAST_PRIOR_COUNT,
  isMonthEndCount: false,
};

const SPECS: Record<string, Spec> = {
  "2025-10": priorCount(
    "Prior-company count, quantities only (no serials)",
    "Albatros Solutions workbook. The October sheet is dated 30 Oct 2025 inside."
  ),
  "2025-11": priorCount("Prior-company count, quantities only (no serials)", "Albatros Solutions workbook."),
  "2025-12": priorCount("Prior-company count, quantities only (no serials)", "Albatros Solutions workbook."),
  "2026-01": priorCount(
    "Prior-company count, 31 Jan 2026",
    "Albatros Solutions workbook, with the January Terminal Movement Report and 7 vouchers. Totals equal December's, but the line mix differs."
  ),
  "2026-02": ALBATROS_NO_COUNT,
  "2026-03": ALBATROS_NO_COUNT,
  "2026-04": ALBATROS_NO_COUNT,
  "2026-05": {
    kind: "handover",
    title:
      "Stock received at HNA offices – hand-over. No count taken; stock confirmed by Finance against the 31 Jan 2026 Albatros count",
    detail:
      "Stock physically received from Albatros at HNA's offices. Receiving count: none taken. Figures are carried forward from the 31 Jan 2026 count.",
    watermark: "Hand-over – no count taken – carried forward from 31 Jan 2026",
    carriedFromMonthKey: LAST_PRIOR_COUNT,
    isMonthEndCount: false,
  },
  "2026-06": {
    kind: "no_count",
    title:
      "No count on record – carried forward from 31 Jan 2026 (as confirmed at the May 2026 hand-over)",
    detail: "No count was taken in June 2026. This is not a month-end count.",
    watermark: "No count on record – carried forward from 31 Jan 2026",
    carriedFromMonthKey: LAST_PRIOR_COUNT,
    isMonthEndCount: false,
  },
};

const EMAILED_NOT_STORED: Spec = {
  kind: "emailed_not_stored",
  title: "Pack emailed, not stored",
  detail:
    "This month's finance pack was emailed but not kept by the system. An administrator can upload the emailed PDF; it is recorded as re-imported.",
  watermark: null,
  carriedFromMonthKey: null,
  isMonthEndCount: false,
};

const SYSTEM_PACK: Spec = {
  kind: "system_pack",
  title: "System month-end",
  detail: "Generated and stored automatically on the 1st of the following month.",
  watermark: null,
  carriedFromMonthKey: null,
  isMonthEndCount: true,
};

export function periodInfo(monthKey: string): PeriodInfo {
  let spec = SPECS[monthKey];
  if (!spec) {
    if (monthKey >= FIRST_SYSTEM_PACK_MONTH) spec = SYSTEM_PACK;
    else if (monthKey >= "2026-07") spec = EMAILED_NOT_STORED;
    else throw new Error(`No period before ${FIRST_PERIOD}: ${monthKey}`);
  }
  return {
    ...spec,
    monthKey,
    monthLabel: monthLabelOf(monthKey),
    notesFirst: notesFirstFor(monthKey),
  };
}

/** Every period from Oct 2025 through `lastMonthKey`, oldest first. */
export function periodsThrough(lastMonthKey: string): PeriodInfo[] {
  const out: PeriodInfo[] = [];
  for (let key = FIRST_PERIOD; key <= lastMonthKey; key = nextMonthKey(key)) {
    out.push(periodInfo(key));
  }
  return out;
}

/** Months stored as prior-company quantity records (real counts and carried-forward months). */
export const PRIOR_SERIES_MONTHS = [
  "2025-10",
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
] as const;
