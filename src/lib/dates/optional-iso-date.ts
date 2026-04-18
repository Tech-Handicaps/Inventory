/** Parse JSON body fields for optional calendar dates (YYYY-MM-DD or ISO). */
export function optionalIsoDateFromBody(
  value: unknown
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (t === "") return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export function toDateInputValue(d: Date | string | null | undefined): string {
  if (d == null) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  return x.toISOString().slice(0, 10);
}
