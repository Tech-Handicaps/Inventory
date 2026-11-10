import type { ReplacementReservation } from "@/lib/finance/reservation-shared";
import { isPlaceholderValue } from "@/lib/inventory/template-duplicates";

export type BoardStatus = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

export type OpenAssessmentBrief = {
  id: string;
  referenceNumber: string;
  workflowStatus: string;
};

export type BoardAsset = {
  id: string;
  assetName: string;
  category: string;
  tags?: string[] | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  reason: string | null;
  dateUpdated: string;
  dataSource: string;
  zohoAssistDeviceId: string | null;
  deviceLocation: string | null;
  processorName: string | null;
  systemRam: string | null;
  systemGpu: string | null;
  lastSyncedFromAssistAt: string | null;
  publicIp: string | null;
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  purchaseDate: string | null;
  warrantyEndDate: string | null;
  status: BoardStatus;
  deviceTemplate?: {
    id: string;
    label: string;
    manufacturer?: string | null;
    model?: string | null;
  } | null;
  club?: { id: string; name: string } | null;
  /** Open assessments for this asset (API returns at most one). */
  assessments?: OpenAssessmentBrief[];
  /** Set while this stock unit is reserved for a club; excluded from available stock. */
  replacementReservation?: ReplacementReservation | null;
};

export function isDepotStock(asset: BoardAsset): boolean {
  return asset.status.code === "new_stock" || asset.status.code === "refurbished";
}

/** Board column order, left to right. */
export const BOARD_STAGE_ORDER = [
  "new_stock",
  "deployed",
  "assessment",
  "repair",
  "refurbished",
  "written_off",
] as const;

/** Status dot colours: green = distributable, amber = needs attention, red = written off. */
export const STAGE_DOT: Record<string, string> = {
  new_stock: "bg-brand",
  deployed: "bg-sky-600",
  assessment: "bg-amber-500",
  repair: "bg-amber-600",
  refurbished: "bg-hna-green-strong",
  written_off: "bg-red-600",
};

export function openAssessment(asset: BoardAsset): OpenAssessmentBrief | null {
  return asset.assessments?.[0] ?? null;
}

export function assetMoveLabel(asset: BoardAsset): string {
  const serial = asset.serialNumber?.trim();
  return serial && !isPlaceholderValue(serial) ? `SN ${serial}` : asset.assetName;
}
