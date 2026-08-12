import { prisma } from "@/lib/prisma";
import { prismaGeoFieldsFromPublicIp } from "@/lib/geo/lookup-ip";
import {
  extractAssistListRows,
  extractDeploymentStatusFromAssistRow,
  findAssistListRowByResourceId,
  mapAssistDeviceJsonToHardwareFields,
  mergeAssistListComputerIntoMapped,
} from "@/lib/zoho/assist-device-map";
import {
  detachAssistFromAsset,
  handleAssistDeviceMissingOnSync,
  isAssistDeploymentUninstalled,
  shouldClearAssistLink,
} from "@/lib/zoho/assist-lifecycle";
import {
  fetchAssistDeviceDetails,
  fetchAssistDevicesList,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
  ZOHO_ASSIST_DEVICES_MAX_COUNT,
} from "@/lib/zoho/client";

/** ip-api.com free tier ~45 req/min — stay under with spacing between lookups. */
const DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function buildAssistListRowMap(
  accessToken: string,
  departmentId: string,
  orgId?: string
): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  let index = 1;

  while (true) {
    const json = await fetchAssistDevicesList(accessToken, {
      departmentId,
      orgId,
      index,
      count: ZOHO_ASSIST_DEVICES_MAX_COUNT,
    });
    const rows = extractAssistListRows(json);
    if (rows.length === 0) break;

    for (const row of rows) {
      map.set(row.resourceId, row.raw);
    }

    if (rows.length < ZOHO_ASSIST_DEVICES_MAX_COUNT) break;
    index += ZOHO_ASSIST_DEVICES_MAX_COUNT;
  }

  return map;
}

async function findAssistListRowForResourceId(
  accessToken: string,
  departmentId: string,
  orgId: string | undefined,
  resourceId: string
): Promise<unknown | null> {
  let index = 1;

  while (true) {
    const json = await fetchAssistDevicesList(accessToken, {
      departmentId,
      orgId,
      index,
      count: ZOHO_ASSIST_DEVICES_MAX_COUNT,
    });
    const row = findAssistListRowByResourceId(json, resourceId);
    if (row) return row;

    const rows = extractAssistListRows(json);
    if (rows.length === 0 || rows.length < ZOHO_ASSIST_DEVICES_MAX_COUNT) {
      return null;
    }
    index += ZOHO_ASSIST_DEVICES_MAX_COUNT;
  }
}

async function detachIfAssistLinkStale(
  assetId: string,
  args: {
    listRowRaw: unknown | null;
    mappedDeploymentStatus?: string | null;
    reason: string;
  }
): Promise<boolean> {
  if (
    !shouldClearAssistLink({
      listRowRaw: args.listRowRaw,
      mappedDeploymentStatus: args.mappedDeploymentStatus,
    })
  ) {
    return false;
  }

  await detachAssistFromAsset(assetId, {
    userId: null,
    reason: args.reason,
    resetAssistDisplayName: true,
  });
  return true;
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
  detached: number;
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
      detached: 0,
      errors: [{ assetId: "-", message: "Zoho Assist is not configured" }],
    };
  }

  const departmentId = settings.defaultDepartmentId?.trim();
  if (!departmentId) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 1,
      detached: 0,
      errors: [{ assetId: "-", message: "Default department id missing in Zoho Assist settings" }],
    };
  }

  const orgId = settings.defaultOrgId?.trim() || undefined;
  const { access_token } = await refreshZohoAccessToken(settings);

  let listRowMap: Map<string, unknown>;
  try {
    listRowMap = await buildAssistListRowMap(
      access_token,
      departmentId,
      orgId
    );
  } catch (e) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 1,
      detached: 0,
      errors: [
        {
          assetId: "-",
          message:
            e instanceof Error
              ? `Could not load Assist device list: ${e.message}`
              : "Could not load Assist device list",
        },
      ],
    };
  }

  const assets = await prisma.asset.findMany({
    where: { zohoAssistDeviceId: { not: null } },
    select: {
      id: true,
      zohoAssistDeviceId: true,
      publicIp: true,
      status: { select: { code: true } },
    },
  });

  if (assets.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, detached: 0, errors: [] };
  }

  const errors: { assetId: string; message: string }[] = [];
  let succeeded = 0;
  let detached = 0;

  for (const a of assets) {
    const assistId = a.zohoAssistDeviceId;
    if (!assistId) {
      continue;
    }
    try {
      const listRowRaw = listRowMap.get(assistId) ?? null;
      const mappedDeploymentStatus = listRowRaw
        ? extractDeploymentStatusFromAssistRow(listRowRaw)
        : undefined;

      const detachedNow = await detachIfAssistLinkStale(a.id, {
        listRowRaw,
        mappedDeploymentStatus,
        reason: listRowRaw
          ? "assist_agent_uninstalled_on_sync"
          : "assist_device_missing_from_list",
      });
      if (detachedNow) {
        detached += 1;
        await delay(DELAY_MS);
        continue;
      }

      const raw = await fetchAssistDeviceDetails(access_token, assistId, {
        departmentId,
        orgId,
      });
      let mapped = mapAssistDeviceJsonToHardwareFields(raw);
      mapped = mergeAssistListComputerIntoMapped(listRowRaw ?? undefined, mapped);

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
      const missing = await handleAssistDeviceMissingOnSync(a.id, e);
      if (missing === "detached") {
        detached += 1;
      } else {
        errors.push({
          assetId: a.id,
          message: e instanceof Error ? e.message : "Sync failed",
        });
      }
    }

    await delay(DELAY_MS);
  }

  return {
    processed: assets.length,
    succeeded,
    failed: errors.length,
    detached,
    errors,
  };
}

export async function syncPublicIpForOneAsset(assetId: string): Promise<{
  ok: boolean;
  detached?: boolean;
  error?: string;
  assetId?: string;
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
    let listRowRaw: unknown | null = null;
    try {
      listRowRaw = await findAssistListRowForResourceId(
        access_token,
        settings.defaultDepartmentId.trim(),
        orgId,
        asset.zohoAssistDeviceId
      );
    } catch (listError) {
      console.warn("syncPublicIpForOneAsset Assist list lookup failed", listError);
    }

    let mappedDeploymentStatus: string | null | undefined;
    if (listRowRaw) {
      mappedDeploymentStatus = extractDeploymentStatusFromAssistRow(listRowRaw);
    }

    const detachedNow = await detachIfAssistLinkStale(asset.id, {
      listRowRaw,
      mappedDeploymentStatus,
      reason: listRowRaw
        ? "assist_agent_uninstalled_on_sync"
        : "assist_device_missing_from_list",
    });
    if (detachedNow) {
      return { ok: true, detached: true, assetId: asset.id };
    }

    const raw = await fetchAssistDeviceDetails(
      access_token,
      asset.zohoAssistDeviceId,
      {
        departmentId: settings.defaultDepartmentId.trim(),
        orgId,
      }
    );
    let mapped = mapAssistDeviceJsonToHardwareFields(raw);
    mapped = mergeAssistListComputerIntoMapped(listRowRaw ?? undefined, mapped);

    if (
      !listRowRaw &&
      isAssistDeploymentUninstalled(mapped.deploymentStatus)
    ) {
      await detachAssistFromAsset(asset.id, {
        userId: null,
        reason: "assist_agent_uninstalled_on_sync",
        resetAssistDisplayName: true,
      });
      return { ok: true, detached: true, assetId: asset.id };
    }

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
    return { ok: true, assetId: asset.id };
  } catch (e) {
    const missing = await handleAssistDeviceMissingOnSync(assetId, e);
    if (missing === "detached") {
      return { ok: true, detached: true, assetId: asset.id };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sync failed",
    };
  }
}
