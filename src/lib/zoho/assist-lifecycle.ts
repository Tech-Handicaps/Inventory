import { createAuditLog } from "@/lib/audit/audit-log";
import { prismaGeoFieldsFromPublicIp } from "@/lib/geo/lookup-ip";
import { resolveHardwareFieldFromAssistAndTemplate } from "@/lib/inventory/assist-hardware-values";
import {
  assetTagsForDisplay,
  resolveTagsForSave,
} from "@/lib/inventory/asset-tags";
import type { Prisma } from "@prisma/client";
import type { AssistHardwareFields } from "@/lib/zoho/assist-device-map";
import {
  buildDepotAssetName,
  isAssistDeviceNotFoundError,
  isAssistDeploymentUninstalled,
  isDepotStockStatus,
} from "@/lib/zoho/assist-lifecycle-shared";
import { prisma } from "@/lib/prisma";

export {
  buildDepotAssetName,
  isAssistDeviceNotFoundError,
  isAssistDeploymentUninstalled,
  isDepotStockStatus,
} from "@/lib/zoho/assist-lifecycle-shared";
export {
  hardwareBoardMoveError,
  HARDWARE_BOARD_STATUS_MOVES,
  isAllowedHardwareBoardMove,
} from "@/lib/inventory/hardware-board-moves";

export type DetachAssistOptions = {
  userId?: string | null;
  reason: string;
  /** When true and asset is depot stock, replace Assist display name with depot label. */
  resetAssistDisplayName?: boolean;
};

/**
 * Remove Zoho Assist association from an asset.
 * Optionally renames depot-stock units so the board no longer shows stale Assist names.
 */
export async function detachAssistFromAsset(
  assetId: string,
  options: DetachAssistOptions
): Promise<
  Prisma.AssetGetPayload<{
    include: { status: true; deviceTemplate: true; club: true };
  }> | null
> {
  const before = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { status: true, deviceTemplate: true, club: true },
  });
  if (!before?.zohoAssistDeviceId) return before;

  const prevAssistId = before.zohoAssistDeviceId;
  const resetName = options.resetAssistDisplayName === true;

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: {
      dataSource: "manual",
      zohoAssistDeviceId: null,
      zohoAssistOrgId: null,
      zohoAssistDepartmentId: null,
      lastSyncedFromAssistAt: null,
      publicIpAssistSyncedAt: null,
      ...(resetName ? { assetName: buildDepotAssetName(before) } : {}),
    },
    include: { status: true, deviceTemplate: true, club: true },
  });

  await createAuditLog({
    userId: options.userId ?? null,
    actionType: "asset.unlinked_from_zoho_assist",
    notes: `Assist link removed (${options.reason}): ${before.assetName}`,
    metadata: {
      assetId,
      zohoAssistDeviceId: prevAssistId,
      reason: options.reason,
      resetAssistDisplayName: resetName,
      previousAssetName: before.assetName,
      newAssetName: resetName ? updated.assetName : undefined,
    },
  });

  return updated;
}

/** On sync failure: auto-detach when Assist device was deleted. */
export async function handleAssistDeviceMissingOnSync(
  assetId: string,
  error: unknown,
  userId?: string | null
): Promise<"detached" | "ignored"> {
  if (!isAssistDeviceNotFoundError(error)) return "ignored";

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, zohoAssistDeviceId: true, status: { select: { code: true } } },
  });
  if (!asset?.zohoAssistDeviceId) return "ignored";

  await detachAssistFromAsset(assetId, {
    userId,
    reason: "assist_device_missing_on_sync",
    // When Assist soft/uninstall happens we want to remove any stale Assist-derived
    // asset naming across all lifecycle stages (not only depot stock).
    resetAssistDisplayName: true,
  });
  return "detached";
}

type RedeployFromAssistInput = {
  existingAssetId: string;
  assistId: string;
  mapped: AssistHardwareFields;
  assetName: string;
  clubId?: string;
  orgId?: string | null;
  departmentId: string;
  template?: {
    id: string;
    tags?: string[] | null;
    category: string;
    manufacturer: string;
    model: string;
    processorName?: string | null;
    systemRam?: string | null;
    systemGpu?: string | null;
  } | null;
  userId?: string | null;
};

/**
 * Same physical unit (serial) re-registered in Assist after depot/refurb cycle:
 * link new Assist device, apply Assist display name, deploy to club.
 */
export async function redeployStockAssetFromAssistImport(
  input: RedeployFromAssistInput
): Promise<
  Prisma.AssetGetPayload<{
    include: { status: true; deviceTemplate: true; club: true };
  }>
> {
  const deployed = await prisma.assetStatus.findFirst({
    where: { code: "deployed" },
  });
  if (!deployed) {
    throw new Error("Deployed status missing");
  }

  const ip = input.mapped.publicIp?.trim() || null;
  const geo = await prismaGeoFieldsFromPublicIp(ip);
  const now = new Date();

  const tagResolution = input.template
    ? resolveTagsForSave({
        tags: assetTagsForDisplay(input.template.tags, input.template.category),
        category: input.template.category,
      })
    : null;

  const updated = await prisma.asset.update({
    where: { id: input.existingAssetId },
    data: {
      assetName: input.assetName,
      statusId: deployed.id,
      clubId: input.clubId ?? null,
      dataSource: "zoho_assist",
      zohoAssistDeviceId: input.assistId,
      zohoAssistOrgId: input.orgId ?? undefined,
      zohoAssistDepartmentId: input.departmentId,
      deviceTemplateId: input.template?.id,
      ...(tagResolution
        ? { tags: tagResolution.tags, category: tagResolution.category }
        : {}),
      deviceLocation: input.mapped.deviceLocation ?? undefined,
      manufacturer: resolveHardwareFieldFromAssistAndTemplate(
        input.mapped.manufacturer,
        input.template?.manufacturer
      ),
      model: resolveHardwareFieldFromAssistAndTemplate(
        input.mapped.model,
        input.template?.model
      ),
      processorName: resolveHardwareFieldFromAssistAndTemplate(
        input.mapped.processorName,
        input.template?.processorName
      ),
      systemRam: resolveHardwareFieldFromAssistAndTemplate(
        input.mapped.systemRam,
        input.template?.systemRam
      ),
      systemGpu: resolveHardwareFieldFromAssistAndTemplate(
        input.mapped.systemGpu,
        input.template?.systemGpu
      ),
      lastSyncedFromAssistAt: now,
      publicIp: ip ?? undefined,
      publicIpAssistSyncedAt: ip ? now : undefined,
      ...geo,
    },
    include: { status: true, deviceTemplate: true, club: true },
  });

  await createAuditLog({
    userId: input.userId ?? null,
    actionType: "asset.redeployed_from_zoho_assist",
    notes: `Redeployed ${updated.assetName} from Assist after serial match (depot → deployed)`,
    metadata: {
      assetId: updated.id,
      zohoAssistDeviceId: input.assistId,
      clubId: input.clubId ?? null,
      serialNumber: updated.serialNumber,
    },
  });

  return updated;
}
