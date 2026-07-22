import type { Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit/audit-log";
import { createWrittenOffAcknowledgementAndNotify } from "@/lib/finance/acknowledgement-notify";
import { prisma } from "@/lib/prisma";

export type WriteOffAssetInput = {
  assetId: string;
  userId: string;
  reason: string;
  serialNumber?: string | null;
  replacementRequested?: boolean;
  replacementNotes?: string | null;
  assessmentId?: string;
};

type WrittenOffAsset = Prisma.AssetGetPayload<{
  include: { status: true; deviceTemplate: true; club: true };
}>;

export type WriteOffAssetResult =
  | { ok: true; asset: WrittenOffAsset }
  | { ok: false; status: number; error: string };

function normalizeSerial(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
}

export async function writeOffAsset(
  input: WriteOffAssetInput
): Promise<WriteOffAssetResult> {
  const reason = input.reason.trim();
  if (!reason) {
    return { ok: false, status: 400, error: "Write-off reason is required." };
  }

  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
    include: { status: true },
  });
  if (!asset) {
    return { ok: false, status: 404, error: "Asset not found" };
  }

  if (asset.status.code !== "assessment" && asset.status.code !== "repair") {
    return {
      ok: false,
      status: 400,
      error:
        "Write-off report is only required from Assessment/Maintenance or In Repairs. Change status another way for other stages.",
    };
  }

  const writtenOffStatus = await prisma.assetStatus.findFirst({
    where: { code: "written_off" },
  });
  if (!writtenOffStatus) {
    return {
      ok: false,
      status: 500,
      error: "Written off lifecycle status missing — run db seed.",
    };
  }

  let assessmentRow: {
    id: string;
    assetId: string;
    workflowStatus: string;
    referenceNumber: string;
  } | null = null;

  if (asset.status.code === "assessment") {
    const assessmentId = input.assessmentId?.trim();
    if (!assessmentId) {
      return {
        ok: false,
        status: 400,
        error:
          "assessmentId is required — open Write off from the Assessment/Maintenance card so the intake is completed correctly.",
      };
    }
    const row = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        assetId: true,
        workflowStatus: true,
        referenceNumber: true,
      },
    });
    if (!row || row.assetId !== asset.id) {
      return {
        ok: false,
        status: 400,
        error: "Assessment/Maintenance intake not found for this asset.",
      };
    }
    if (row.workflowStatus !== "open") {
      return {
        ok: false,
        status: 400,
        error: `Assessment/Maintenance intake ${row.referenceNumber} is not open.`,
      };
    }
    assessmentRow = row;
  } else if (input.assessmentId?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "assessmentId is only used when writing off from Assessment/Maintenance.",
    };
  }

  const nextSerial =
    input.serialNumber !== undefined
      ? normalizeSerial(input.serialNumber)
      : undefined;
  if (
    nextSerial &&
    nextSerial !== asset.serialNumber
  ) {
    const taken = await prisma.asset.findFirst({
      where: {
        serialNumber: nextSerial,
        NOT: { id: asset.id },
      },
      select: { id: true, assetName: true },
    });
    if (taken) {
      return {
        ok: false,
        status: 409,
        error: `Serial number "${nextSerial}" is already registered on "${taken.assetName}".`,
      };
    }
  }

  const replacementRequested = input.replacementRequested === true;
  const replacementNotes = replacementRequested
    ? input.replacementNotes?.trim() || null
    : null;

  const updated = await prisma.$transaction(async (tx) => {
    if (assessmentRow) {
      await tx.assessment.update({
        where: { id: assessmentRow.id },
        data: {
          workflowStatus: "completed",
          completedAt: new Date(),
        },
      });
    }

    return tx.asset.update({
      where: { id: asset.id },
      data: {
        statusId: writtenOffStatus.id,
        reason,
        ...(nextSerial !== undefined ? { serialNumber: nextSerial } : {}),
      },
      include: { status: true, deviceTemplate: true, club: true },
    });
  });

  if (assessmentRow) {
    await createAuditLog({
      userId: input.userId,
      actionType: "assessment.completed",
      notes: `Assessment/Maintenance intake ${assessmentRow.referenceNumber} completed — written off: ${asset.assetName}`,
      metadata: {
        assessmentId: assessmentRow.id,
        referenceNumber: assessmentRow.referenceNumber,
        assetId: asset.id,
        outcome: "written_off",
        writeOffReason: reason,
        replacementRequested,
      },
    });
  }

  await createAuditLog({
    userId: input.userId,
    actionType: "asset.write_off",
    notes: `Written off: ${asset.assetName}${reason ? ` — ${reason}` : ""}`,
    metadata: {
      assetId: asset.id,
      writeOffReason: reason,
      replacementRequested,
      replacementNotes,
      fromStatusCode: asset.status.code,
      ...(assessmentRow
        ? {
            assessmentId: assessmentRow.id,
            assessmentReference: assessmentRow.referenceNumber,
          }
        : {}),
    },
  });

  try {
    await createWrittenOffAcknowledgementAndNotify({
      assetId: asset.id,
      reason,
      replacementRequested,
      replacementNotes,
      assessmentReference: assessmentRow?.referenceNumber ?? null,
    });
  } catch (e) {
    console.error("createWrittenOffAcknowledgementAndNotify", e);
  }

  return { ok: true, asset: updated };
}
