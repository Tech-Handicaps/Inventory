import { breaksLenovoRule, type AliasKind } from "@/lib/inventory/model-aliases";

export type AliasInput = { kind: AliasKind; alias: string; canonical: string; notes: string | null };

export function parseAliasInput(body: unknown): { data: AliasInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing to save" };
  const input = body as Record<string, unknown>;
  const kind = input.kind === "manufacturer" ? "manufacturer" : input.kind === "model" ? "model" : null;
  const alias = typeof input.alias === "string" ? input.alias.trim().replace(/\s+/g, " ") : "";
  const canonical = typeof input.canonical === "string" ? input.canonical.trim().replace(/\s+/g, " ") : "";
  if (!kind) return { error: "Choose model or manufacturer" };
  if (!alias || !canonical || alias.length > 120 || canonical.length > 120) {
    return { error: "Both the spelling and the name to use are required" };
  }
  if (alias.toLowerCase() === canonical.toLowerCase()) return { error: "The alias and the name are the same" };
  if (breaksLenovoRule(alias, canonical)) {
    return { error: "Lenovo M810z and Lenovo 10Q0 are different models and cannot be aliased" };
  }
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim().slice(0, 500) : null;
  return { data: { kind, alias, canonical, notes } };
}
