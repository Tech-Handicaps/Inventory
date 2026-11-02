import { classifyReportAssetType } from "@/lib/reports/asset-types";
import type { FieldCaptureBreakdown, FieldTerminal } from "@/lib/reports/field-export";

export type ReconLine = {
  id: string;
  sortOrder: number;
  section: string;
  label: string;
  quantity: number;
  status: string;
  notes: string | null;
  evidenceDocumentId: string | null;
  updatedAt: string;
};

export const RECON_SECTIONS = {
  opening: "Prior count",
  excluded: "Not tracked by serial",
  added: "Added since",
  written_off: "Written off",
} as const;

export type ReconSection = keyof typeof RECON_SECTIONS;

export function isReconSection(value: unknown): value is ReconSection {
  return typeof value === "string" && value in RECON_SECTIONS;
}

export type RegisterComposition = {
  total: number;
  hardware: {
    total: number;
    newStock: number;
    refurbished: number;
    deployed: number;
    assessment: number;
    repair: number;
    writtenOff: number;
  };
  usbReaders: number;
  other: number;
  writtenOffWithCertificate: number;
  pendingDisposal: number;
};

export type RegisterAsset = {
  category: string;
  tags: string[];
  statusCode: string;
  hasCertificate: boolean;
};

export function registerComposition(assets: RegisterAsset[]): RegisterComposition {
  const out: RegisterComposition = {
    total: assets.length,
    hardware: { total: 0, newStock: 0, refurbished: 0, deployed: 0, assessment: 0, repair: 0, writtenOff: 0 },
    usbReaders: 0,
    other: 0,
    writtenOffWithCertificate: 0,
    pendingDisposal: 0,
  };
  for (const asset of assets) {
    const type = classifyReportAssetType(asset.category, asset.tags);
    if (asset.statusCode === "written_off") {
      if (asset.hasCertificate) out.writtenOffWithCertificate += 1;
      else out.pendingDisposal += 1;
    }
    if (type === "usb_hid_msr") {
      out.usbReaders += 1;
      continue;
    }
    if (type === "other") {
      out.other += 1;
      continue;
    }
    out.hardware.total += 1;
    if (asset.statusCode === "new_stock") out.hardware.newStock += 1;
    else if (asset.statusCode === "refurbished") out.hardware.refurbished += 1;
    else if (asset.statusCode === "deployed") out.hardware.deployed += 1;
    else if (asset.statusCode === "assessment") out.hardware.assessment += 1;
    else if (asset.statusCode === "repair") out.hardware.repair += 1;
    else if (asset.statusCode === "written_off") out.hardware.writtenOff += 1;
  }
  return out;
}

export type ReconciliationReport = {
  lines: (ReconLine & { runningTotal: number })[];
  bridgedTotal: number;
  register: RegisterComposition;
  /** Register minus the bridged total. Never forced to zero; shown as "to be confirmed". */
  unexplained: number;
  toBeConfirmed: number;
};

/** Lines are added in order; whatever is left against the register stays visible. */
export function buildReconciliation(lines: ReconLine[], register: RegisterComposition): ReconciliationReport {
  const ordered = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  let running = 0;
  const withTotals = ordered.map((line) => {
    running += line.quantity;
    return { ...line, runningTotal: running };
  });
  return {
    lines: withTotals,
    bridgedTotal: running,
    register,
    unexplained: register.total - running,
    toBeConfirmed: ordered.filter((line) => line.status !== "confirmed").length,
  };
}

export type FieldExportBaseline = {
  fileName: string;
  exportDate: string;
  terminalsAtClubs: number;
  hnaOwned: number;
  clubOwned: number;
  blankOwnership: number;
  clubIds: number;
};

/**
 * Totals of the field terminal export (spec 5.10), used when the stored file cannot be read.
 * The file has 2 blank-ownership rows and 341 club IDs (the spec's 3 and 342 do not add up to 354).
 */
export const FIELD_EXPORT_BASELINE: FieldExportBaseline = {
  fileName: "Terminal make levels 1 October 2025.xlsx",
  exportDate: "2025-10-14",
  terminalsAtClubs: 354,
  hnaOwned: 305,
  clubOwned: 47,
  blankOwnership: 2,
  clubIds: 341,
};

export function baselineFromTerminals(
  terminals: FieldTerminal[],
  meta: { fileName: string; exportDate: string }
): FieldExportBaseline {
  return {
    ...meta,
    terminalsAtClubs: terminals.length,
    hnaOwned: terminals.filter((t) => t.ownership === "HNA").length,
    clubOwned: terminals.filter((t) => t.ownership === "Club").length,
    blankOwnership: terminals.filter((t) => t.ownership === "").length,
    clubIds: new Set(terminals.map((t) => t.clubId || t.club)).size,
  };
}

export type FieldCapture = {
  baseline: FieldExportBaseline;
  /** The stored export the breakdown was read from; null when only the fallback totals are available. */
  sourceDocumentId: string | null;
  captured: number;
  notYetCaptured: number;
  capturedPct: number;
  breakdown: FieldCaptureBreakdown | null;
};

export function fieldCapture(
  deployedHardware: number,
  base: FieldExportBaseline = FIELD_EXPORT_BASELINE,
  breakdown: FieldCaptureBreakdown | null = null,
  sourceDocumentId: string | null = null
): FieldCapture {
  const captured = Math.min(deployedHardware, base.hnaOwned);
  return {
    baseline: base,
    sourceDocumentId,
    captured,
    notYetCaptured: Math.max(base.hnaOwned - deployedHardware, 0),
    capturedPct: base.hnaOwned ? Math.round((captured / base.hnaOwned) * 1000) / 10 : 0,
    breakdown,
  };
}
