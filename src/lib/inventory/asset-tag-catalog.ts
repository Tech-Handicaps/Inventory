/**
 * Curated asset identification tags — shown as autocomplete suggestions.
 * Custom tags can still be added when registering hardware.
 */

export type AssetTagGroup = {
  label: string;
  tags: string[];
};

export const ASSET_TAG_GROUPS: AssetTagGroup[] = [
  {
    label: "Finance & stock types",
    tags: ["Hardware", "USB HID Magnetic Stripe Reader"],
  },
  {
    label: "Computers & endpoints",
    tags: ["Laptop", "Desktop", "Tablet", "Server", "Thin Client"],
  },
  {
    label: "POS & field",
    tags: ["POS Terminal", "Terminal", "Kiosk", "Monitor", "Printer"],
  },
  {
    label: "Peripherals & readers",
    tags: [
      "Magnetic Stripe Reader",
      "MSR",
      "Card Reader",
      "Barcode Scanner",
      "Receipt Printer",
    ],
  },
  {
    label: "Infrastructure",
    tags: ["Network", "Switch", "Router", "Access Point", "AV Equipment"],
  },
];

/** Flat catalog for autocomplete (deduped, sorted). */
export const ASSET_TAG_CATALOG: string[] = [
  ...new Set(ASSET_TAG_GROUPS.flatMap((g) => g.tags)),
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
