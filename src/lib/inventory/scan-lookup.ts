import { Prisma } from "@prisma/client";
import { listAssetsSimple, type ListedAsset } from "@/lib/inventory/asset-query";
import { isPlaceholderValue } from "@/lib/inventory/template-duplicates";
import { parseScanCode, type ParsedScanCode } from "@/lib/inventory/scan-code";
import { prisma } from "@/lib/prisma";

export type ScanMatchBy = "asset_link" | "serial" | "asset_name";

export type ScanLookupResult = {
  parsed: ParsedScanCode;
  asset: ListedAsset | null;
  matchedBy: ScanMatchBy | null;
};

/** BIOS / Assist filler that is not a real serial, so the unit can take a scanned one. */
const BIOS_PLACEHOLDER_SERIALS = [
  "system serial number",
  "to be filled by o.e.m.",
  "default string",
  "0123456789",
  "chassis serial number",
];

export function isMissingSerial(serial: string | null): boolean {
  if (!serial) return true;
  const v = serial.trim().toLowerCase();
  return isPlaceholderValue(v) || BIOS_PLACEHOLDER_SERIALS.includes(v);
}

async function idBySerialIgnoringSpaces(serial: string): Promise<string | null> {
  const compact = serial.replace(/[\s-]+/g, "").toLowerCase();
  if (!compact) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM "Asset"
    WHERE regexp_replace(lower("serialNumber"), '[\\s-]+', '', 'g') = ${compact}
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

async function findMatch(parsed: ParsedScanCode): Promise<{ id: string; by: ScanMatchBy } | null> {
  if (parsed.kind === "asset_id") {
    const row = await prisma.asset.findUnique({ where: { id: parsed.assetId }, select: { id: true } });
    return row ? { id: row.id, by: "asset_link" } : null;
  }
  const insensitive = (v: string) => ({ equals: v, mode: "insensitive" as const });
  const bySerial = await prisma.asset.findFirst({
    where: { OR: [{ serialNumber: insensitive(parsed.serial) }, { serialNumber: insensitive(parsed.raw) }] },
    select: { id: true },
  });
  if (bySerial) return { id: bySerial.id, by: "serial" };
  const loose = await idBySerialIgnoringSpaces(parsed.serial);
  if (loose) return { id: loose, by: "serial" };
  const byName = await prisma.asset.findFirst({
    where: { OR: [{ assetName: insensitive(parsed.raw) }, { assetName: insensitive(parsed.serial) }] },
    select: { id: true },
  });
  return byName ? { id: byName.id, by: "asset_name" } : null;
}

/** Resolve a scanned barcode / QR code to an asset (serial, asset link, or printed asset name). */
export async function lookupScannedCode(code: string): Promise<ScanLookupResult | null> {
  const parsed = parseScanCode(code);
  if (!parsed) return null;
  const match = await findMatch(parsed);
  if (!match) return { parsed, asset: null, matchedBy: null };
  const { assets } = await listAssetsSimple({ where: { id: match.id }, limit: 1 });
  return { parsed, asset: assets[0] ?? null, matchedBy: assets[0] ? match.by : null };
}

export type SerialCandidate = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  status: { code: string; label: string };
  club: { name: string } | null;
};

/** Units still waiting for a real serial, for "attach this serial to an existing unit". */
export async function unitsWithoutSerial(): Promise<SerialCandidate[]> {
  const rows = await prisma.asset.findMany({
    where: { NOT: { status: { code: "written_off" } } },
    select: {
      id: true,
      assetName: true,
      serialNumber: true,
      manufacturer: true,
      model: true,
      status: { select: { code: true, label: true } },
      club: { select: { name: true } },
    },
    orderBy: { assetName: "asc" },
  });
  return rows.filter((r) => isMissingSerial(r.serialNumber));
}
