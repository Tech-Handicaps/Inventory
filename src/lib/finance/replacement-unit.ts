import { prisma } from "@/lib/prisma";
import { withDerivedDeviceTemplateLabel } from "@/lib/inventory/device-template-label";
import {
  reservationLabel,
  type ReplacementReservation,
} from "@/lib/finance/reservation-shared";

/** Lifecycle stages a replacement unit can be taken from. */
export const REPLACEMENT_STOCK_STATUS_CODES = ["new_stock", "refurbished"] as const;

export type ReplacementSelection =
  | { source: "stock"; stockAssetId: string }
  | { source: "procure"; deviceTemplateId: string };

export type ReplacementSnapshot = {
  replacementAssetId: string | null;
  replacementAssetName: string;
  replacementAssetType: string;
  replacementMakeModel: string;
  replacementSerialNumber: string | null;
};

export { reservationLabel, type ReplacementReservation };

export type ReplacementStockOption = {
  id: string;
  assetName: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  statusCode: string;
  statusLabel: string;
  sameModel: boolean;
  sameCategory: boolean;
  reservedBy: ReplacementReservation | null;
};

export type ReplacementTemplateOption = {
  id: string;
  label: string;
  manufacturer: string;
  model: string;
  category: string;
  sameModel: boolean;
};

export function formatMakeModel(
  manufacturer: string | null | undefined,
  model: string | null | undefined
): string {
  return [manufacturer?.trim(), model?.trim()].filter(Boolean).join(" · ");
}

function sameText(a: string | null | undefined, b: string | null | undefined) {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  return Boolean(x) && x === y;
}

/**
 * Stock units currently reserved for a club (from the write-off form or "Send to club").
 * Pass "all" to load every active reservation (board, available counts).
 * `excludeWrittenOffAssetId` ignores reservations made for that write-off (re-saving the same write-off).
 */
export async function findReplacementReservations(
  stockAssetIds: string[] | "all",
  excludeWrittenOffAssetId?: string
): Promise<Map<string, ReplacementReservation>> {
  const out = new Map<string, ReplacementReservation>();
  if (stockAssetIds !== "all" && stockAssetIds.length === 0) return out;

  const rows = await prisma.asset.findMany({
    where: {
      reservedAt: { not: null },
      status: { code: { in: [...REPLACEMENT_STOCK_STATUS_CODES] } },
      ...(stockAssetIds === "all" ? {} : { id: { in: stockAssetIds } }),
      ...(excludeWrittenOffAssetId
        ? { NOT: { reservedForWriteOff: { assetId: excludeWrittenOffAssetId } } }
        : {}),
    },
    select: {
      id: true,
      reservedAt: true,
      reservedForClubId: true,
      reservedForClub: { select: { name: true } },
      reservedForWriteOffId: true,
      reservedForWriteOff: { select: { referenceNumber: true, assetName: true } },
    },
  });

  for (const r of rows) {
    out.set(r.id, {
      reservedAt: r.reservedAt!.toISOString(),
      clubId: r.reservedForClubId,
      clubName: r.reservedForClub?.name ?? null,
      writeOffId: r.reservedForWriteOffId,
      certificateReference: r.reservedForWriteOff?.referenceNumber ?? null,
      writtenOffAssetName: r.reservedForWriteOff?.assetName ?? null,
    });
  }
  return out;
}

/** Ids of stock units currently reserved — left out of "available to distribute". */
export async function reservedReplacementAssetIds(): Promise<Set<string>> {
  return new Set((await findReplacementReservations("all")).keys());
}
/** Stock units and device templates offered on the write-off form, closest match first. */
export async function listReplacementOptions(writtenOffAssetId: string): Promise<{
  stock: ReplacementStockOption[];
  templates: ReplacementTemplateOption[];
} | null> {
  const target = await prisma.asset.findUnique({
    where: { id: writtenOffAssetId },
    select: { id: true, category: true, manufacturer: true, model: true, deviceTemplateId: true },
  });
  if (!target) return null;

  const [stockRows, templateRows] = await Promise.all([
    prisma.asset.findMany({
      where: {
        id: { not: target.id },
        status: { code: { in: [...REPLACEMENT_STOCK_STATUS_CODES] } },
      },
      select: {
        id: true,
        assetName: true,
        category: true,
        manufacturer: true,
        model: true,
        serialNumber: true,
        status: { select: { code: true, label: true } },
      },
      orderBy: [{ assetName: "asc" }],
    }),
    prisma.deviceTemplate.findMany({
      orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
    }),
  ]);

  const reservations = await findReplacementReservations(
    stockRows.map((r) => r.id),
    target.id
  );

  const stock: ReplacementStockOption[] = stockRows.map((r) => ({
    id: r.id,
    assetName: r.assetName,
    category: r.category,
    manufacturer: r.manufacturer,
    model: r.model,
    serialNumber: r.serialNumber,
    statusCode: r.status.code,
    statusLabel: r.status.label,
    sameModel: sameText(r.model, target.model),
    sameCategory: sameText(r.category, target.category),
    reservedBy: reservations.get(r.id) ?? null,
  }));
  stock.sort(
    (a, b) =>
      Number(Boolean(a.reservedBy)) - Number(Boolean(b.reservedBy)) ||
      Number(b.sameModel) - Number(a.sameModel) ||
      Number(b.sameCategory) - Number(a.sameCategory) ||
      a.assetName.localeCompare(b.assetName)
  );

  const templates: ReplacementTemplateOption[] = templateRows
    .map(withDerivedDeviceTemplateLabel)
    .map((t) => ({
      id: t.id,
      label: t.label,
      manufacturer: t.manufacturer,
      model: t.model,
      category: t.category,
      sameModel:
        t.id === target.deviceTemplateId || sameText(t.model, target.model),
    }));
  templates.sort((a, b) => Number(b.sameModel) - Number(a.sameModel));

  return { stock, templates };
}

/** Read the replacement details from the register — never from typed text. */
export async function resolveReplacementSnapshot(
  selection: ReplacementSelection,
  writtenOffAssetId: string
): Promise<
  { ok: true; snapshot: ReplacementSnapshot } | { ok: false; status: number; error: string }
> {
  if (selection.source === "procure") {
    const t = await prisma.deviceTemplate.findUnique({
      where: { id: selection.deviceTemplateId },
    });
    if (!t) {
      return { ok: false, status: 400, error: "Replacement model not found in device templates." };
    }
    const label = withDerivedDeviceTemplateLabel(t).label;
    return {
      ok: true,
      snapshot: {
        replacementAssetId: null,
        replacementAssetName: label,
        replacementAssetType: t.category,
        replacementMakeModel: formatMakeModel(t.manufacturer, t.model),
        replacementSerialNumber: null,
      },
    };
  }

  if (selection.stockAssetId === writtenOffAssetId) {
    return { ok: false, status: 400, error: "A unit cannot replace itself." };
  }
  const unit = await prisma.asset.findUnique({
    where: { id: selection.stockAssetId },
    select: {
      id: true,
      assetName: true,
      category: true,
      manufacturer: true,
      model: true,
      serialNumber: true,
      status: { select: { code: true, label: true } },
    },
  });
  if (!unit) {
    return { ok: false, status: 400, error: "Replacement unit not found." };
  }
  if (!(REPLACEMENT_STOCK_STATUS_CODES as readonly string[]).includes(unit.status.code)) {
    return {
      ok: false,
      status: 409,
      error: `"${unit.assetName}" is ${unit.status.label}, not New Stock or Refurbished — pick another unit.`,
    };
  }
  const reserved = (await findReplacementReservations([unit.id], writtenOffAssetId)).get(unit.id);
  if (reserved) {
    return {
      ok: false,
      status: 409,
      error: `"${unit.assetName}" is already reserved for ${reservationLabel(reserved)}. Release it first or pick another unit.`,
    };
  }
  return {
    ok: true,
    snapshot: {
      replacementAssetId: unit.id,
      replacementAssetName: unit.assetName,
      replacementAssetType: unit.category,
      replacementMakeModel: formatMakeModel(unit.manufacturer, unit.model),
      replacementSerialNumber: unit.serialNumber?.trim() || null,
    },
  };
}
