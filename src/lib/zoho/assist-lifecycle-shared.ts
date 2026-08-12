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
