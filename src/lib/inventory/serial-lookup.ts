import { prisma } from "@/lib/prisma";

export type SerialMatch = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  status: { code: string; label: string };
};

/** Case-insensitive so "abc123" and "ABC123" count as the same unit. */
export async function findAssetBySerial(
  serial: string,
  excludeId?: string
): Promise<SerialMatch | null> {
  const trimmed = serial.trim();
  if (!trimmed) return null;
  return prisma.asset.findFirst({
    where: {
      serialNumber: { equals: trimmed, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: {
      id: true,
      assetName: true,
      serialNumber: true,
      status: { select: { code: true, label: true } },
    },
  });
}
