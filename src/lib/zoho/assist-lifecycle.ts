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
  isHnaWriteOffAssetName,
  nextHnaWriteOffAssetName,
  resolveReplacementAssetName,
  shouldClearAssistLink,
} from "@/lib/zoho/assist-lifecycle-shared";
import { tryDeleteAssistDeviceForAsset } from "@/lib/zoho/client";
import { prisma } from "@/lib/prisma";

export {
  buildDepotAssetName,
  isAssistDeviceNotFoundError,
  isAssistDeploymentUninstalled,
  isDepotStockStatus,
  isHnaWriteOffAssetName,
  looksLikeHnaAssistDeploymentName,
  nextHnaStockAssetName,
  nextHnaWriteOffAssetName,
  resolveReplacementAssetName,
  shouldClearAssistLink,
} from "@/lib/zoho/assist-lifecycle-shared";
export {
  hardwareBoardMoveError,
  HARDWARE_BOARD_STATUS_MOVES,
  isAllowedHardwareBoardMove,
} from "@/lib/inventory/hardware-board-moves";

export type DetachAssistOptions = {
  userId?: string | null;
  reason: string;
  /** When true, replace Assist display name with inventory stock/hardware label (e.g. HNA-ST…). */
  resetAssistDisplayName?: boolean;
  /**
   * When true, attempt DELETE of the unattended computer in Zoho Assist before unlinking locally.
   * Local unlink + optional rename still run if Assist delete fails.
   */
  deleteInAssist?: boolean;
};

export type DetachAssistResult = Prisma.AssetGetPayload<{
  include: { status: true; deviceTemplate: true; club: true };
}> & {
  assistDeleted?: boolean;
  assistDeleteError?: string | null;
};

async function loadExistingStockNames(): Promise<string[]> {
  const rows = await prisma.asset.findMany({
    where: { assetName: { startsWith: "HNA-ST", mode: "insensitive" } },
    select: { assetName: true },
  });
  return rows.map((row) => row.assetName);
}

async function loadExistingWriteOffNames(): Promise<string[]> {
  const rows = await prisma.asset.findMany({
    where: { assetName: { startsWith: "HNA-WRO", mode: "insensitive" } },
    select: { assetName: true },
  });
  return rows.map((row) => row.assetName);
}

export type WriteOffAssistCleanup = {
  previousAssetName: string;
  newAssetName: string;
  clubCleared: boolean;
  previousClubName: string | null;
  assistWasLinked: boolean;
  assistDeleted: boolean;
  assistDeleteError: string | null;
};

/**
 * After the write-off certificate is saved: clear the club, rename to HNA-WRO…,
 * delete the device in Zoho Assist when possible, and unlink Assist locally.
 * Certificate already holds the original name/club for finance.
 */
export async function retireAssetAfterWriteOff(params: {
  assetId: string;
  userId: string | null;
  certificateReference: string;
}): Promise<WriteOffAssistCleanup> {
  const before = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: {
      assetName: true,
      clubId: true,
      club: { select: { name: true } },
      zohoAssistDeviceId: true,
      zohoAssistOrgId: true,
      zohoAssistDepartmentId: true,
    },
  });
  if (!before) {
    throw new Error("Asset not found for write-off retirement");
  }

  const previousAssetName = before.assetName;
  const previousClubName = before.club?.name ?? null;
  const assistWasLinked = Boolean(before.zohoAssistDeviceId);

  let assistDeleted = false;
  let assistDeleteError: string | null = null;
  if (assistWasLinked) {
    const deleted = await tryDeleteAssistDeviceForAsset(before);
    if (deleted?.ok) {
      assistDeleted = true;
    } else if (deleted && !deleted.ok) {
      assistDeleteError = deleted.error;
    }
  }

  const writeOffNames = await loadExistingWriteOffNames();
  const newAssetName = isHnaWriteOffAssetName(previousAssetName)
    ? previousAssetName
    : nextHnaWriteOffAssetName(writeOffNames);

  await prisma.asset.update({
    where: { id: params.assetId },
    data: {
      clubId: null,
      assetName: newAssetName,
      dataSource: "manual",
      zohoAssistDeviceId: null,
      zohoAssistOrgId: null,
      zohoAssistDepartmentId: null,
      lastSyncedFromAssistAt: null,
      publicIpAssistSyncedAt: null,
    },
  });

  if (assistWasLinked) {
    await createAuditLog({
      userId: params.userId,
      actionType: "asset.unlinked_from_zoho_assist",
      notes: `Assist link removed on write-off ${params.certificateReference}: ${previousAssetName}${
        assistDeleted
          ? " (deleted in Zoho Assist)"
          : assistDeleteError
            ? ` (Assist delete failed: ${assistDeleteError})`
            : ""
      }`,
      metadata: {
        assetId: params.assetId,
        zohoAssistDeviceId: before.zohoAssistDeviceId,
        reason: "write_off",
        writeOffCertificate: params.certificateReference,
        assistDeleted,
        assistDeleteError,
        previousAssetName,
        newAssetName,
      },
    });
  }

  await createAuditLog({
    userId: params.userId,
    actionType: "asset.write_off_retired",
    notes: `Write-off retirement ${params.certificateReference}: ${previousAssetName} → ${newAssetName}; club cleared${
      previousClubName ? ` (was ${previousClubName})` : ""
    }`,
    metadata: {
      assetId: params.assetId,
      writeOffCertificate: params.certificateReference,
      previousAssetName,
      newAssetName,
      previousClubId: before.clubId,
      previousClubName,
      assistWasLinked,
      assistDeleted,
      assistDeleteError,
    },
  });

  return {
    previousAssetName,
    newAssetName,
    clubCleared: before.clubId !== null,
    previousClubName,
    assistWasLinked,
    assistDeleted,
    assistDeleteError,
  };
}

/**
 * Remove Zoho Assist association from an asset.
 * Optionally deletes the device in Assist, and renames depot-stock units to HNA-ST….
 */
export async function detachAssistFromAsset(
  assetId: string,
  options: DetachAssistOptions
): Promise<DetachAssistResult | null> {
  const before = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { status: true, deviceTemplate: true, club: true },
  });
  if (!before?.zohoAssistDeviceId) return before;

  const prevAssistId = before.zohoAssistDeviceId;
  let assistDeleted = false;
  let assistDeleteError: string | null = null;

  if (options.deleteInAssist === true) {
    const deleted = await tryDeleteAssistDeviceForAsset(before);
    if (deleted?.ok) {
      assistDeleted = true;
    } else if (deleted && !deleted.ok) {
      assistDeleteError = deleted.error;
    }
  }

  const resetName = options.resetAssistDisplayName === true;
  const stockNames = resetName ? await loadExistingStockNames() : [];
  const nextAssetName = resetName
    ? resolveReplacementAssetName(before, stockNames)
    : undefined;

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: {
      dataSource: "manual",
      zohoAssistDeviceId: null,
      zohoAssistOrgId: null,
      zohoAssistDepartmentId: null,
      lastSyncedFromAssistAt: null,
      publicIpAssistSyncedAt: null,
      ...(resetName && nextAssetName ? { assetName: nextAssetName } : {}),
    },
    include: { status: true, deviceTemplate: true, club: true },
  });

  await createAuditLog({
    userId: options.userId ?? null,
    actionType: "asset.unlinked_from_zoho_assist",
    notes: `Assist link removed (${options.reason}): ${before.assetName}${
      options.deleteInAssist
        ? assistDeleted
          ? " (deleted in Zoho Assist)"
          : assistDeleteError
            ? ` (Assist delete failed: ${assistDeleteError})`
            : ""
        : ""
    }`,
    metadata: {
      assetId,
      zohoAssistDeviceId: prevAssistId,
      reason: options.reason,
      resetAssistDisplayName: resetName,
      deleteInAssist: options.deleteInAssist === true,
      assistDeleted,
      assistDeleteError,
      previousAssetName: before.assetName,
      newAssetName: resetName ? updated.assetName : undefined,
    },
  });

  return {
    ...updated,
    assistDeleted,
    assistDeleteError,
  };
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
