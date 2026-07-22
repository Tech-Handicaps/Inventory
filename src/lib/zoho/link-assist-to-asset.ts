import type { Prisma } from "@prisma/client";
import { prismaGeoFieldsFromPublicIp } from "@/lib/geo/lookup-ip";
import {
  mapAssistDeviceJsonToHardwareFields,
  mergeAssistListComputerIntoMapped,
} from "@/lib/zoho/assist-device-map";
import { resolveAssistResourceId } from "@/lib/zoho/resolve-assist-resource";
import {
  fetchAssistDeviceDetails,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
} from "@/lib/zoho/client";
import { prisma } from "@/lib/prisma";

function strOrNull(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
}

/** Prefer existing registry value; fill from Assist only when empty. */
function mergeOptionalField(
  current: string | null | undefined,
  fromAssist: string | null | undefined
): string | null | undefined {
  if (strOrNull(current)) return current ?? null;
  const next = strOrNull(fromAssist);
  return next ?? (current === undefined ? undefined : null);
}

export type LinkAssistToAssetInput = {
  assetId: string;
  resourceId?: string;
  displayName?: string;
};

export type LinkAssistToAssetResult =
  | {
      ok: true;
      asset: Prisma.AssetGetPayload<{
        include: { status: true; deviceTemplate: true; club: true };
      }>;
      assistDeviceId: string;
      assistDisplayName: string | null;
      serialMismatchWarning: string | null;
    }
  | { ok: false; status: number; code?: string; error: string; assetId?: string };

export async function linkAssistToAsset(
  input: LinkAssistToAssetInput
): Promise<LinkAssistToAssetResult> {
  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
    include: { status: true, deviceTemplate: true, club: true },
  });
  if (!asset) {
    return { ok: false, status: 404, error: "Asset not found" };
  }

  const c = await loadZohoAssistSettings();
  if (!c.clientId || !c.clientSecret || !c.refreshToken) {
    return {
      ok: false,
      status: 400,
      error: "Zoho Assist is not configured (save OAuth credentials first).",
    };
  }
  const departmentId = c.defaultDepartmentId?.trim() || "";
  if (!departmentId) {
    return {
      ok: false,
      status: 400,
      error:
        "Set Default department id in Settings → Zoho Assist (required for device APIs).",
    };
  }

  const { access_token } = await refreshZohoAccessToken(c);
  const orgId = c.defaultOrgId;

  let resolved: { resourceId: string; listComputer?: unknown };
  try {
    resolved = await resolveAssistResourceId(access_token, departmentId, orgId, {
      resourceId: input.resourceId,
      displayName: input.displayName,
    });
  } catch (e) {
    return {
      ok: false,
      status: 400,
      error: e instanceof Error ? e.message : "Could not resolve Assist device",
    };
  }

  const assistId = resolved.resourceId;

  if (asset.zohoAssistDeviceId === assistId) {
    return {
      ok: true,
      asset,
      assistDeviceId: assistId,
      assistDisplayName: asset.assetName,
      serialMismatchWarning: null,
    };
  }

  const taken = await prisma.asset.findFirst({
    where: {
      zohoAssistDeviceId: assistId,
      NOT: { id: asset.id },
    },
    select: { id: true, assetName: true },
  });
  if (taken) {
    return {
      ok: false,
      status: 409,
      code: "ASSIST_DEVICE_ALREADY_LINKED",
      error: `This Assist device is already linked to "${taken.assetName}".`,
      assetId: taken.id,
    };
  }

  const raw = await fetchAssistDeviceDetails(access_token, assistId, {
    departmentId,
    orgId,
  });
  let mapped = mapAssistDeviceJsonToHardwareFields(raw);
  mapped = mergeAssistListComputerIntoMapped(resolved.listComputer, mapped);

  const assistSerial = strOrNull(mapped.serialNumber);
  const registrySerial = strOrNull(asset.serialNumber);
  let serialMismatchWarning: string | null = null;
  if (
    registrySerial &&
    assistSerial &&
    registrySerial.toLowerCase() !== assistSerial.toLowerCase()
  ) {
    serialMismatchWarning = `Assist reports serial "${assistSerial}" but this asset is registered as "${registrySerial}". Registry serial was kept.`;
  }

  const ip = mapped.publicIp?.trim() || null;
  const geo = ip ? await prismaGeoFieldsFromPublicIp(ip) : null;
  const now = new Date();

  const updated = await prisma.asset.update({
    where: { id: asset.id },
    data: {
      dataSource: "zoho_assist",
      zohoAssistDeviceId: assistId,
      zohoAssistOrgId: orgId ?? undefined,
      zohoAssistDepartmentId: departmentId,
      lastSyncedFromAssistAt: now,
      ...(ip
        ? {
            publicIp: ip,
            publicIpAssistSyncedAt: now,
            ...geo,
          }
        : {}),
      deviceLocation: mergeOptionalField(asset.deviceLocation, mapped.deviceLocation),
      manufacturer: mergeOptionalField(asset.manufacturer, mapped.manufacturer),
      model: mergeOptionalField(asset.model, mapped.model),
      processorName: mergeOptionalField(asset.processorName, mapped.processorName),
      systemRam: mergeOptionalField(asset.systemRam, mapped.systemRam),
      systemGpu: mergeOptionalField(asset.systemGpu, mapped.systemGpu),
      // Registry serial is authoritative — never overwrite from Assist on link.
      serialNumber: asset.serialNumber,
    },
    include: { status: true, deviceTemplate: true, club: true },
  });

  return {
    ok: true,
    asset: updated,
    assistDeviceId: assistId,
    assistDisplayName:
      mapped.assetName?.trim() ||
      input.displayName?.trim() ||
      null,
    serialMismatchWarning,
  };
}
