import { isReconSection, type ReconSection } from "@/lib/reports/reconciliation";

export type ReconLineInput = {
  section: ReconSection;
  label: string;
  quantity: number;
  status: "confirmed" | "to_be_confirmed";
  notes: string | null;
};

export function parseReconLineInput(body: unknown): { data: ReconLineInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing to save" };
  const input = body as Record<string, unknown>;
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const quantity = typeof input.quantity === "number" ? input.quantity : Number(input.quantity);
  if (!isReconSection(input.section)) return { error: "Choose a section" };
  if (!label || label.length > 300) return { error: "A label is required (300 characters at most)" };
  if (!Number.isInteger(quantity) || Math.abs(quantity) > 100_000) return { error: "Quantity must be a whole number" };
  const status = input.status === "confirmed" ? "confirmed" : "to_be_confirmed";
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 2000) : null;
  return { data: { section: input.section, label, quantity, status, notes } };
}
