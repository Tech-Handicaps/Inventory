import { prisma } from "@/lib/prisma";
import { prismaGeoFieldsFromPublicIp } from "@/lib/geo/lookup-ip";
import {
  mapAssistDeviceJsonToHardwareFields,
  mergeAssistListComputerIntoMapped,
} from "@/lib/zoho/assist-device-map";
import {
  fetchAssistDeviceDetails,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
} from "@/lib/zoho/client";

/** ip-api.com free tier ~45 req/min — stay under with spacing between lookups. */
const DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveNextPublicIp(
  mapped: { publicIp?: string },
  previous: string | null
): string | null {
  if (mapped.publicIp !== undefined) {
    const t = mapped.publicIp?.trim();
    return t ? t : null;
  }
  return previous;
}

export type SyncPublicIpResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: { assetId: string; message: string }[];
};

/**
 * Re-fetch Assist device JSON for every asset with `zohoAssistDeviceId`, update public IP + GeoIP.
 */
export async function syncAllAssistAssetsPublicIp(): Promise<SyncPublicIpResult> {
  const settings = await loadZohoAssistSettings();
  if (!settings) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 1,
      errors: [{ assetId: "-", message: "Zoho Assist is not configured" }],
    };
  }

  const departmentId = settings.defaultDepartmentId?.trim();
  if (!departmentId) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 1,
      errors: [{ assetId: "-", message: "Default department id missing in Zoho Assist settings" }],
    };
  }

  const orgId = settings.defaultOrgId?.trim() || undefined;
  const { access_token } = await refreshZohoAccessToken(settings);

  const assets = await prisma.asset.findMany({
    where: { zohoAssistDeviceId: { not: null } },
    select: {
      id: true,
      zohoAssistDeviceId: true,
      publicIp: true,
    },
  });

  if (assets.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  const errors: { assetId: string; message: string }[] = [];
  let succeeded = 0;

  for (const a of assets) {
    const assistId = a.zohoAssistDeviceId;
    if (!assistId) {
      continue;
    }
    try {
      const raw = await fetchAssistDeviceDetails(access_token, assistId, {
        departmentId,
        orgId,
      });
      let mapped = mapAssistDeviceJsonToHardwareFields(raw);
      mapped = mergeAssistListComputerIntoMapped(undefined, mapped);
      const nextIp = resolveNextPublicIp(mapped, a.publicIp);
      const geo = await prismaGeoFieldsFromPublicIp(nextIp);

      await prisma.asset.update({
        where: { id: a.id },
        data: {
          publicIp: nextIp,
          publicIpAssistSyncedAt: new Date(),
          lastSyncedFromAssistAt: new Date(),
          ...geo,
        },
      });
      succeeded += 1;
    } catch (e) {
      errors.push({
        assetId: a.id,
        message: e instanceof Error ? e.message : "Sync failed",
      });
    }

    await delay(DELAY_MS);
  }

  return {
    processed: assets.length,
    succeeded,
    failed: errors.length,
    errors,
  };
}

export async function syncPublicIpForOneAsset(assetId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      zohoAssistDeviceId: true,
      publicIp: true,
    },
  });
  if (!asset) return { ok: false, error: "Asset not found" };
  if (!asset.zohoAssistDeviceId) {
    return { ok: false, error: "No Zoho Assist device id on this asset" };
  }

  const settings = await loadZohoAssistSettings();
  if (!settings?.defaultDepartmentId?.trim()) {
    return { ok: false, error: "Zoho Assist settings incomplete" };
  }
  const orgId = settings.defaultOrgId?.trim() || undefined;
  const { access_token } = await refreshZohoAccessToken(settings);

  try {
    const raw = await fetchAssistDeviceDetails(
      access_token,
      asset.zohoAssistDeviceId,
      {
        departmentId: settings.defaultDepartmentId.trim(),
        orgId,
      }
    );
    let mapped = mapAssistDeviceJsonToHardwareFields(raw);
    mapped = mergeAssistListComputerIntoMapped(undefined, mapped);
    const nextIp = resolveNextPublicIp(mapped, asset.publicIp);
    const geo = await prismaGeoFieldsFromPublicIp(nextIp);

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        publicIp: nextIp,
        publicIpAssistSyncedAt: new Date(),
        lastSyncedFromAssistAt: new Date(),
        ...geo,
      },
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sync failed",
    };
  }
}
