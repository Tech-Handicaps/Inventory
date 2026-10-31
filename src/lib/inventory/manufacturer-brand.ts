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

/** Brand for an asset, from its own manufacturer or (when blank/placeholder) its template's. */
export function manufacturerBrand(
  manufacturer: string | null | undefined,
  templateManufacturer?: string | null
): string {
  const raw = normalizeAssistHardwareValue(manufacturer) ?? normalizeAssistHardwareValue(templateManufacturer);
  if (!raw) return UNKNOWN_BRAND;
  const key = normaliseManufacturer(raw);
  if (!key) return UNKNOWN_BRAND;
  for (const [pattern, brand] of BRAND_BY_KEY) {
    if (pattern.test(key)) return brand;
  }
  return titleCase(key);
}
