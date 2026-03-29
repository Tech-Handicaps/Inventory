import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function toInputJson(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Best-effort audit trail. Never throws — failures are logged only.
 */
export async function createAuditLog(entry: {
  userId: string;
  actionType: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        actionType: entry.actionType,
        notes: entry.notes ?? null,
        metadata: toInputJson(entry.metadata),
      },
    });
  } catch (e) {
    console.error("createAuditLog failed", e);
  }
}
