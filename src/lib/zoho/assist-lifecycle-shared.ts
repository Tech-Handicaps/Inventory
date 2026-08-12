const DEPOT_STOCK_STATUSES = new Set(["refurbished", "new_stock"]);

export function isDepotStockStatus(statusCode: string): boolean {
  return DEPOT_STOCK_STATUSES.has(statusCode);
}

/**
 * True when Zoho Assist reports the unattended agent/software is no longer installed
 * (e.g. "uninstalled", "deleted", "removed", etc.).
 *
 * Note: Zoho payloads vary; this is a conservative heuristic based on deployment status text.
 */
export function isAssistDeploymentUninstalled(deploymentStatus: string | null | undefined): boolean {
  if (!deploymentStatus) return false;
  const s = deploymentStatus.toLowerCase();
  return (
    s.includes("uninstall") ||
    s.includes("uninstalled") ||
    s.includes("deleted") ||
    s.includes("removed") ||
    s.includes("no longer") ||
    s.includes("not installed")
  );
}

/** True when Assist list row indicates the device record is gone or inactive. */
export function shouldClearAssistLink(args: {
  listRowRaw: unknown | null;
  mappedDeploymentStatus?: string | null;
}): boolean {
  if (!args.listRowRaw) return true;

  const deployment =
    extractDeploymentStatusFromAssistListRow(args.listRowRaw) ??
    args.mappedDeploymentStatus ??
    null;
  if (isAssistDeploymentUninstalled(deployment)) return true;

  const liveStatus = extractLiveStatusFromAssistListRow(args.listRowRaw);
  if (liveStatus) {
    const norm = liveStatus.toLowerCase();
    if (norm === "deleted" || norm === "removed") return true;
  }

  return false;
}

function extractDeploymentStatusFromAssistListRow(rowRaw: unknown): string | undefined {
  const row = typeof rowRaw === "object" && rowRaw ? (rowRaw as Record<string, unknown>) : null;
  const di =
    row?.device_info && typeof row.device_info === "object"
      ? (row.device_info as Record<string, unknown>)
      : null;
  const read = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return (
    read(di?.deployment_status) ??
    read(di?.deploymentStatus) ??
    read(di?.agent_deployment_status) ??
    undefined
  );
}

function extractLiveStatusFromAssistListRow(rowRaw: unknown): string | undefined {
  const row = typeof rowRaw === "object" && rowRaw ? (rowRaw as Record<string, unknown>) : null;
  const di =
    row?.device_info && typeof row.device_info === "object"
      ? (row.device_info as Record<string, unknown>)
      : null;
  const read = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return read(di?.status) ?? read(row?.status);
}

/** True when Assist API indicates the unattended device no longer exists. */
export function isAssistDeviceNotFoundError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    msg.includes("Assist API 404") ||
    lower.includes("not found") ||
    lower.includes("invalid resource") ||
    lower.includes("does not exist") ||
    lower.includes("no device") ||
    lower.includes("resource not found")
  );
}

const HNA_STOCK_NAME_RE = /^HNA-ST(\d+)$/i;

/** True for club/field Assist nicknames like HNA-ATLANTIC-01 (not stock numbers). */
export function looksLikeHnaAssistDeploymentName(assetName: string): boolean {
  return /^HNA-(?!ST)/i.test(assetName.trim());
}

/** Next sequential stock label: HNA-ST001, HNA-ST002, … */
export function nextHnaStockAssetName(existingNames: readonly string[]): string {
  let max = 0;
  for (const name of existingNames) {
    const match = name.trim().match(HNA_STOCK_NAME_RE);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return `HNA-ST${String(max + 1).padStart(3, "0")}`;
}

/** Inventory-native label for depot stock after Assist display name is cleared. */
export function buildDepotAssetName(asset: {
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  deviceTemplate?: { label: string } | null;
}): string {
  const templateLabel = asset.deviceTemplate?.label?.trim();
  const makeModel = [asset.manufacturer, asset.model]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" ");
  const base = templateLabel || makeModel || "Refurbished unit";
  const serial = asset.serialNumber?.trim();
  return serial ? `${base} · S/N ${serial}` : base;
}

/** Pick the replacement name when clearing a stale Assist nickname. */
export function resolveReplacementAssetName(
  asset: {
    assetName: string;
    serialNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    status: { code: string };
    deviceTemplate?: { label: string } | null;
  },
  existingStockNames: readonly string[]
): string {
  const current = asset.assetName.trim();
  if (HNA_STOCK_NAME_RE.test(current)) return current;

  if (
    isDepotStockStatus(asset.status.code) ||
    looksLikeHnaAssistDeploymentName(current)
  ) {
    return nextHnaStockAssetName(existingStockNames);
  }

  return buildDepotAssetName(asset);
}
