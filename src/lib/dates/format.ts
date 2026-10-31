/**
 * The one place dates are formatted for people: UI, CSV exports, PDFs and emails.
 * Dates read `18 Apr 2026`; date-times read `18 Apr 2026 14:05 SAST`.
 * Machine values (API JSON, filenames, `<input type="date">`) stay ISO.
 */

export const APP_TIME_ZONE = "Africa/Johannesburg";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sastParts(date: Date): { day: string; month: string; year: string; time: string } {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) parts[part.type] = part.value;
  return {
    day: parts.day,
    month: MONTHS[Number(parts.month) - 1],
    year: parts.year,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** `18 Apr 2026`, or `fallback` when the value is missing or invalid. */
export function formatDate(value: DateInput, fallback = "—"): string {
  const date = toDate(value);
  if (!date) return fallback;
  const { day, month, year } = sastParts(date);
  return `${day} ${month} ${year}`;
}

/** `18 Apr 2026 14:05 SAST`, or `fallback` when the value is missing or invalid. */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const date = toDate(value);
  if (!date) return fallback;
  const { day, month, year, time } = sastParts(date);
  return `${day} ${month} ${year} ${time} SAST`;
}
