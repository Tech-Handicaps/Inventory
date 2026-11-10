import { createAuditLog } from "@/lib/audit/audit-log";
import { createDispatchVoucherAndNotify } from "@/lib/finance/dispatch-notify";
import {
  findReplacementReservations,
  REPLACEMENT_STOCK_STATUS_CODES,
  reservationLabel,
} from "@/lib/finance/replacement-unit";
import { prisma } from "@/lib/prisma";

export type ReservedReplacementDeployVia =
  | "assist_import"
  | "assist_link"
  | "status_change";

const VIA_LABEL: Record<ReservedReplacementDeployVia, string> = {
  assist_import: "imported from Zoho Assist",
  assist_link: "linked to Zoho Assist",
  status_change: "moved to Deployed",
};

const CLEARED_RESERVATION = {
  reservedForClubId: null,
  reservedAt: null,
  reservedByUserId: null,
  reservedForWriteOffId: null,
} as const;

type ReserveResult =
  | { ok: true; clubName: string }
  | { ok: false; status: number; error: string };

/** Set a New Stock / Refurbished unit aside for a club until it shows up in Zoho Assist. */
export async function reserveAssetForClub(params: {
  assetId: string;
  /** Null only for write-off replacements whose written-off unit had no club. */
  clubId: string | null;
  userId: string | null;
  writeOffId?: string | null;
}): Promise<ReserveResult> {
  const [asset, club] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: params.assetId },
      select: { assetName: true, reservedAt: true, status: { select: { code: true, label: true } } },
    }),
    params.clubId
      ? prisma.club.findUnique({ where: { id: params.clubId }, select: { name: true } })
      : null,
  ]);
  if (!asset) return { ok: false, status: 404, error: "Asset not found" };
  if (params.clubId && !club) return { ok: false, status: 400, error: "Club not found" };
  if (!params.clubId && !params.writeOffId) {
    return { ok: false, status: 400, error: "Choose the club this unit is going to." };
  }
  const clubName = club?.name ?? "the written-off unit's site (no club on record)";
  if (!(REPLACEMENT_STOCK_STATUS_CODES as readonly string[]).includes(asset.status.code)) {
    return {
      ok: false,
      status: 409,
      error: `"${asset.assetName}" is ${asset.status.label}. Only New Stock or Refurbished units can be reserved.`,
    };
  }
  const existing = (await findReplacementReservations([params.assetId])).get(params.assetId);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: `"${asset.assetName}" is already reserved for ${reservationLabel(existing)}. Release it first.`,
    };
  }

  await prisma.asset.update({
    where: { id: params.assetId },
    data: {
      reservedForClubId: params.clubId,
      reservedAt: new Date(),
      reservedByUserId: params.userId,
      reservedForWriteOffId: params.writeOffId ?? null,
    },
  });
  await createAuditLog({
    userId: params.userId,
    actionType: "asset.reserved",
    notes: `Reserved ${asset.assetName} for ${clubName} — moves to Deployed when it appears in Zoho Assist`,
    metadata: {
      assetId: params.assetId,
      clubId: params.clubId,
      clubName: club?.name ?? null,
      writeOffId: params.writeOffId ?? null,
    },
  });
  return { ok: true, clubName };
}

/**
 * A reserved unit has gone out: mark it Deployed (when asked), give it the reserved club unless a
 * club was already chosen, clear the reservation, and issue the usual dispatch notice.
 * Returns null when the unit isn't reserved, so callers can call it unconditionally.
 */
export async function deployReservedReplacement(params: {
  assetId: string;
  fromStatusCode: string;
  userId: string | null;
  via: ReservedReplacementDeployVia;
  setDeployedStatus?: boolean;
}): Promise<{ clubName: string | null; dispatchReference: string | null } | null> {
  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: {
      assetName: true,
      clubId: true,
      reservedAt: true,
      reservedForClubId: true,
      reservedForClub: { select: { name: true } },
      reservedForWriteOff: { select: { referenceNumber: true, assetName: true } },
    },
  });
  if (!asset?.reservedAt) return null;

  const deployedStatus = params.setDeployedStatus
    ? await prisma.assetStatus.findFirst({ where: { code: "deployed" }, select: { id: true } })
    : null;
  if (params.setDeployedStatus && !deployedStatus) {
    throw new Error("Deployed status missing");
  }
  const clubId = asset.clubId ?? asset.reservedForClubId;

  await prisma.asset.update({
    where: { id: params.assetId },
    data: {
      ...CLEARED_RESERVATION,
      ...(deployedStatus ? { statusId: deployedStatus.id } : {}),
      ...(clubId !== asset.clubId ? { clubId } : {}),
    },
  });

  let dispatchReference: string | null = null;
  try {
    dispatchReference =
      (await createDispatchVoucherAndNotify({
        assetId: params.assetId,
        fromStatusCode: params.fromStatusCode,
        reservedReplacement: true,
      }))?.referenceNumber ?? null;
  } catch (e) {
    console.error("deployReservedReplacement dispatch notice", e);
  }

  const clubName = asset.reservedForClub?.name ?? null;
  const forWriteOff = asset.reservedForWriteOff
    ? ` for ${asset.reservedForWriteOff.assetName} (${asset.reservedForWriteOff.referenceNumber})`
    : "";
  await createAuditLog({
    userId: params.userId,
    actionType: "replacement.deployed",
    notes: `Reserved unit ${asset.assetName} ${VIA_LABEL[params.via]} — deployed to ${clubName ?? "club"}${forWriteOff}`,
    metadata: {
      assetId: params.assetId,
      clubId,
      reservedForClubId: asset.reservedForClubId,
      writeOffCertificate: asset.reservedForWriteOff?.referenceNumber ?? null,
      via: params.via,
      fromStatusCode: params.fromStatusCode,
      dispatchVoucher: dispatchReference,
    },
  });

  return { clubName, dispatchReference };
}

/** Free a reserved unit without deploying it (manual release, or it left stock some other way). */
export async function releaseReplacementReservation(params: {
  assetId: string;
  userId: string | null;
  reason: string;
}): Promise<{ clubName: string | null } | null> {
  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: {
      assetName: true,
      reservedAt: true,
      reservedForClub: { select: { name: true } },
      reservedForWriteOff: { select: { referenceNumber: true } },
    },
  });
  if (!asset?.reservedAt) return null;

  await prisma.asset.update({
    where: { id: params.assetId },
    data: CLEARED_RESERVATION,
  });

  const clubName = asset.reservedForClub?.name ?? null;
  await createAuditLog({
    userId: params.userId,
    actionType: "asset.reservation_released",
    notes: `Released ${asset.assetName} — no longer reserved for ${clubName ?? "a club"}: ${params.reason}`,
    metadata: {
      assetId: params.assetId,
      clubName,
      writeOffCertificate: asset.reservedForWriteOff?.referenceNumber ?? null,
      reason: params.reason,
    },
  });
  return { clubName };
}
