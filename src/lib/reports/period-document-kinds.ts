/** Client-safe constants for period documents (no Node or storage imports). */

export const MAX_PERIOD_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const PERIOD_DOCUMENT_KINDS = {
  source_workbook: "Source workbook",
  service_desk_report: "Service Desk Report",
  master_sheet: "Master sheet",
  voucher: "Voucher / certificate",
  handover: "Hand-over record",
  finance_confirmation: "Finance confirmation",
  reimported_pack: "Re-imported finance pack",
  auditor_note: "Auditor note",
  field_export: "Field terminal export",
  other: "Other",
} as const;

export type PeriodDocumentKind = keyof typeof PERIOD_DOCUMENT_KINDS;

export function isPeriodDocumentKind(value: unknown): value is PeriodDocumentKind {
  return typeof value === "string" && value in PERIOD_DOCUMENT_KINDS;
}

/** Service Desk Reports and the Master sheet disagree with the workbooks (spec 5.8). */
export function defaultFlagFor(kind: PeriodDocumentKind): string | null {
  if (kind === "service_desk_report" || kind === "master_sheet") {
    return "Supporting document only – stock table not reliable";
  }
  return null;
}

export const ALLOWED_PERIOD_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
];

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_PERIOD_MIME.includes(mime);
}

