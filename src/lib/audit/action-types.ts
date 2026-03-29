/**
 * Action types written by the API (filters / reporting).
 * Kept separate from audit-log.ts so client components can import without Prisma.
 */
export const AUDIT_ACTION_TYPES = [
  "asset.created",
  "asset.updated",
  "asset.write_off",
  "device_template.created",
  "device_template.updated",
  "device_template.deleted",
  "repair.created",
  "integration.zoho.settings_updated",
  "integration.zoho.oauth_connected",
  "integration.xero.sync_triggered",
] as const;
