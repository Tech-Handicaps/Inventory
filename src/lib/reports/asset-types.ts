/**
 * Report asset types — maps free-text `Asset.category` values into finance buckets.
 * Order matters: more specific types (USB readers) are checked before broad Hardware.
 */

export type ReportAssetTypeId = "usb_hid_msr" | "hardware" | "other";

export type ReportAssetType = {
  id: ReportAssetTypeId;
  label: string;
  /** Case-insensitive substring match against normalized category. */
  categoryPatterns: string[];
};

/** USB HID magnetic stripe readers — checked first so they are not lumped into Hardware. */
export const USB_HID_MSR_TYPE: ReportAssetType = {
  id: "usb_hid_msr",
  label: "USB HID Magnetic Stripe Readers",
  categoryPatterns: [
    "usb hid magnetic stripe",
    "magnetic stripe reader",
    "magnetic stripe",
    "stripe reader",
    "msr",
    "card reader",
    "hid reader",
  ],
};

/** General IT / POS / terminal hardware (excludes USB MSR when classified in memory). */
export const HARDWARE_TYPE: ReportAssetType = {
  id: "hardware",
  label: "Hardware",
  categoryPatterns: [
    "hardware",
    "terminal",
    "pos",
    "kiosk",
    "laptop",
    "desktop",
    "monitor",
    "computer",
    "tablet",
    "server",
    "printer",
  ],
};

export const OTHER_ASSET_TYPE: ReportAssetType = {
  id: "other",
  label: "Other / uncategorized",
  categoryPatterns: [],
};

/** Types shown on reconcile and stock-by-type reports (excludes "other" until needed). */
export const RECONCILE_ASSET_TYPES: ReportAssetType[] = [
  HARDWARE_TYPE,
  USB_HID_MSR_TYPE,
];

export const ALL_REPORT_ASSET_TYPES: ReportAssetType[] = [
  ...RECONCILE_ASSET_TYPES,
  OTHER_ASSET_TYPE,
];

function normalizeCategory(category: string | null | undefined): string {
  return (category ?? "").trim().toLowerCase();
}

function matchesPatterns(category: string, patterns: string[]): boolean {
  if (!category) return false;
  return patterns.some((p) => category.includes(p.toLowerCase()));
}

/** Classify using all identification tags (and legacy category). USB reader tags win over hardware. */
export function classifyReportAssetType(
  category: string | null | undefined,
  tags?: string[] | null
): ReportAssetTypeId {
  const labels = [
    ...(tags ?? []).map((t) => t.trim()).filter(Boolean),
    ...(category?.trim() ? [category.trim()] : []),
  ];
  const seen = new Set<string>();
  const unique = labels.filter((l) => {
    const k = l.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const label of unique) {
    const normalized = normalizeCategory(label);
    if (matchesPatterns(normalized, USB_HID_MSR_TYPE.categoryPatterns)) {
      return "usb_hid_msr";
    }
  }
  for (const label of unique) {
    const normalized = normalizeCategory(label);
    if (matchesPatterns(normalized, HARDWARE_TYPE.categoryPatterns)) {
      return "hardware";
    }
  }
  return "other";
}

export function reportAssetTypeLabel(id: ReportAssetTypeId): string {
  return ALL_REPORT_ASSET_TYPES.find((t) => t.id === id)?.label ?? id;
}

export function reportAssetTypeById(
  id: ReportAssetTypeId
): ReportAssetType | undefined {
  return ALL_REPORT_ASSET_TYPES.find((t) => t.id === id);
}
