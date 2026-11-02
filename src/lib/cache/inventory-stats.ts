import { revalidateTag, unstable_cache } from "next/cache";

/** Tag on every cached register aggregate (Dashboard figures). */
export const INVENTORY_STATS_TAG = "inventory-stats";

/** Safety net if an invalidation is missed (e.g. a write made outside the app). */
const MAX_AGE_SECONDS = 300;

/** Models whose writes change Dashboard figures. */
export const INVENTORY_STATS_MODELS = new Set([
  "Asset",
  "AssetStatus",
  "Club",
  "DeviceTemplate",
  "Repair",
  "Assessment",
  "WriteOffCertificate",
  "DispatchVoucher",
  "XeroSync",
]);

/**
 * Shared across requests and instances, so a cold function serves figures without
 * touching the database. Cleared on every relevant write (see `prisma.ts`).
 */
export function cachedInventoryStat<T>(key: string, load: () => Promise<T>): () => Promise<T> {
  return unstable_cache(load, ["inventory-stats", key], {
    tags: [INVENTORY_STATS_TAG],
    revalidate: MAX_AGE_SECONDS,
  });
}

/** Expires the figures immediately, so the next view after an edit reconciles. */
export function invalidateInventoryStats() {
  try {
    revalidateTag(INVENTORY_STATS_TAG, { expire: 0 });
  } catch {
    /* outside a request (scripts, render): the max age still bounds staleness */
  }
}
