import { normalizeAssistHardwareValue } from "@/lib/inventory/assist-hardware-values";
import { normaliseManufacturer } from "@/lib/inventory/template-duplicates";

export const UNKNOWN_BRAND = "Unknown";

/**
 * Display brand per normalised manufacturer key. Mecer is the brand and Mustek the company,
 * so both count as one OEM ("Mecer"); OEM chipset/company strings map to the brand people use.
 */
const BRAND_BY_KEY: [RegExp, string][] = [
  [/^dell\b/, "Dell"],
  [/^posiflex\b/, "Posiflex"],
  [/^lenovo\b/, "Lenovo"],
  [/^intel\b/, "Intel"],
  [/^gigatek\b/, "Gigatek"],
  [/^(hp|hewlett)\b/, "HP"],
  [/^(mecer|mustek)/, "Mecer"],
  [/^(micro star|msi)\b/, "MSI"],
  [/^partner\b/, "Partner"],
];

function titleCase(key: string): string {
  return key.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Model codes that only one brand uses, for units whose manufacturer was never recorded. */
const BRAND_BY_MODEL: [RegExp, string][] = [
  [/^ps-?\d{4}/i, "Posiflex"],
  [/^nuc/i, "Intel"],
  [/^optiplex\b/i, "Dell"],
  [/^msr\d{3}/i, "Gigatek"],
  [/^x22s\b/i, "Mecer"],
  [/^10q0/i, "Lenovo"],
];

function brandFromModel(model: string | null | undefined): string | null {
  const m = normalizeAssistHardwareValue(model);
  if (!m) return null;
  return BRAND_BY_MODEL.find(([pattern]) => pattern.test(m))?.[1] ?? null;
}

/**
 * Brand for an asset, from its own manufacturer or (when blank/placeholder) its template's,
 * and failing both, from a model code only one brand uses.
 */
export function manufacturerBrand(
  manufacturer: string | null | undefined,
  templateManufacturer?: string | null,
  model?: string | null
): string {
  const raw = normalizeAssistHardwareValue(manufacturer) ?? normalizeAssistHardwareValue(templateManufacturer);
  const key = raw ? normaliseManufacturer(raw) : "";
  if (!key) return brandFromModel(model) ?? UNKNOWN_BRAND;
  for (const [pattern, brand] of BRAND_BY_KEY) {
    if (pattern.test(key)) return brand;
  }
  return titleCase(key);
}

/** A "model" that is only the brand name (e.g. "Mecer") says nothing about the model. */
export function modelForBrand(brand: string, model: string | null | undefined): string | null {
  const m = model?.trim();
  if (!m) return null;
  return m.toLowerCase() === brand.toLowerCase() ? null : m;
}
