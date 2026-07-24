import { dispatchFromStatusLabel } from "@/lib/finance/dispatch-reference";
import { newWriteOffCertificateReference } from "@/lib/finance/write-off-reference";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderWriteOffCertificatePdf } from "@/lib/pdf/write-off-certificate-html";
import { prisma } from "@/lib/prisma";

export type WriteOffCertificateRecord = {
  id: string;
  assetId: string;
  referenceNumber: string;
  assessmentReference: string | null;
  assetName: string;
  clubName: string | null;
  category: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  xeroFixedAssetNumber: string | null;
  reason: string | null;
  replacementRequested: boolean;
  replacementNotes: string | null;
  replacementAssetName: string | null;
  replacementAssetType: string | null;
  replacementMakeModel: string | null;
  replacementSerialNumber: string | null;
  replacementXeroFixedAssetNumber: string | null;
  fromStatusCode: string;
  writtenOffAt: Date;
};

function formatWrittenOffAt(d: Date): string {
  return d.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function trimOrNull(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
}

type WriteOffAuditMeta = {
  replacementRequested?: unknown;
  replacementNotes?: unknown;
  assessmentReference?: unknown;
  fromStatusCode?: unknown;
  writeOffReason?: unknown;
  xeroFixedAssetNumber?: unknown;
  replacementAssetName?: unknown;
  replacementAssetType?: unknown;
  replacementMakeModel?: unknown;
  replacementSerialNumber?: unknown;
  replacementXeroFixedAssetNumber?: unknown;
};

async function writeOffAuditHints(assetId: string): Promise<{
  replacementRequested: boolean;
  replacementNotes: string | null;
  assessmentReference: string | null;
  fromStatusCode: string | null;
  reason: string | null;
  xeroFixedAssetNumber: string | null;
  replacementAssetName: string | null;
  replacementAssetType: string | null;
  replacementMakeModel: string | null;
  replacementSerialNumber: string | null;
  replacementXeroFixedAssetNumber: string | null;
}> {
  const logs = await prisma.auditLog.findMany({
    where: { actionType: "asset.write_off" },
    orderBy: { timestamp: "desc" },
    take: 40,
    select: { metadata: true },
  });

  for (const row of logs) {
    const meta = (row.metadata ?? {}) as WriteOffAuditMeta & {
      assetId?: unknown;
    };
    if (meta.assetId !== assetId) continue;
    return {
      replacementRequested: meta.replacementRequested === true,
      replacementNotes:
        typeof meta.replacementNotes === "string"
          ? meta.replacementNotes.trim() || null
          : null,
      assessmentReference:
        typeof meta.assessmentReference === "string"
          ? meta.assessmentReference.trim() || null
          : null,
      fromStatusCode:
        typeof meta.fromStatusCode === "string"
          ? meta.fromStatusCode.trim() || null
          : null,
      reason:
        typeof meta.writeOffReason === "string"
          ? meta.writeOffReason.trim() || null
          : null,
      xeroFixedAssetNumber:
        typeof meta.xeroFixedAssetNumber === "string"
          ? meta.xeroFixedAssetNumber.trim() || null
          : null,
      replacementAssetName:
        typeof meta.replacementAssetName === "string"
          ? meta.replacementAssetName.trim() || null
          : null,
      replacementAssetType:
        typeof meta.replacementAssetType === "string"
          ? meta.replacementAssetType.trim() || null
          : null,
      replacementMakeModel:
        typeof meta.replacementMakeModel === "string"
          ? meta.replacementMakeModel.trim() || null
          : null,
      replacementSerialNumber:
        typeof meta.replacementSerialNumber === "string"
          ? meta.replacementSerialNumber.trim() || null
          : null,
      replacementXeroFixedAssetNumber:
        typeof meta.replacementXeroFixedAssetNumber === "string"
          ? meta.replacementXeroFixedAssetNumber.trim() || null
          : null,
    };
  }

  const ack = await prisma.financeAcknowledgement.findFirst({
    where: { assetId, eventType: "written_off" },
    orderBy: { createdAt: "desc" },
    select: { referenceText: true },
  });
  const ref = ack?.referenceText ?? "";
  return {
    replacementRequested: /replacement requested/i.test(ref),
    replacementNotes: null,
    assessmentReference: null,
    fromStatusCode: null,
    reason: null,
    xeroFixedAssetNumber: null,
    replacementAssetName: null,
    replacementAssetType: null,
    replacementMakeModel: null,
    replacementSerialNumber: null,
    replacementXeroFixedAssetNumber: null,
  };
}

/** Fill gaps on an existing certificate from write-off audit / ack text. */
async function reconcileCertificateFromAudit(
  cert: WriteOffCertificateRecord
): Promise<WriteOffCertificateRecord> {
  if (
    cert.replacementRequested &&
    cert.assessmentReference &&
    cert.fromStatusCode !== "written_off" &&
    cert.xeroFixedAssetNumber
  ) {
    return cert;
  }

  const hints = await writeOffAuditHints(cert.assetId);
  const nextReplacement =
    cert.replacementRequested || hints.replacementRequested;
  const nextNotes =
    cert.replacementNotes ||
    (nextReplacement ? hints.replacementNotes : null);
  const nextAssessment =
    cert.assessmentReference || hints.assessmentReference;
  const nextFrom =
    cert.fromStatusCode !== "written_off"
      ? cert.fromStatusCode
      : hints.fromStatusCode || cert.fromStatusCode;
  const nextReason = cert.reason || hints.reason;
  const nextXero = cert.xeroFixedAssetNumber || hints.xeroFixedAssetNumber;
  const nextRepName =
    cert.replacementAssetName ||
    (nextReplacement ? hints.replacementAssetName : null);
  const nextRepType =
    cert.replacementAssetType ||
    (nextReplacement ? hints.replacementAssetType : null);
  const nextRepMakeModel =
    cert.replacementMakeModel ||
    (nextReplacement ? hints.replacementMakeModel : null);
  const nextRepSerial =
    cert.replacementSerialNumber ||
    (nextReplacement ? hints.replacementSerialNumber : null);
  const nextRepXero =
    cert.replacementXeroFixedAssetNumber ||
    (nextReplacement ? hints.replacementXeroFixedAssetNumber : null);

  if (
    nextReplacement === cert.replacementRequested &&
    nextNotes === cert.replacementNotes &&
    nextAssessment === cert.assessmentReference &&
    nextFrom === cert.fromStatusCode &&
    nextReason === cert.reason &&
    nextXero === cert.xeroFixedAssetNumber &&
    nextRepName === cert.replacementAssetName &&
    nextRepType === cert.replacementAssetType &&
    nextRepMakeModel === cert.replacementMakeModel &&
    nextRepSerial === cert.replacementSerialNumber &&
    nextRepXero === cert.replacementXeroFixedAssetNumber
  ) {
    return cert;
  }

  try {
    return await prisma.writeOffCertificate.update({
      where: { id: cert.id },
      data: {
        replacementRequested: nextReplacement,
        replacementNotes: nextReplacement ? nextNotes : null,
        assessmentReference: nextAssessment,
        fromStatusCode: nextFrom,
        reason: nextReason,
        xeroFixedAssetNumber: nextXero,
        replacementAssetName: nextReplacement ? nextRepName : null,
        replacementAssetType: nextReplacement ? nextRepType : null,
        replacementMakeModel: nextReplacement ? nextRepMakeModel : null,
        replacementSerialNumber: nextReplacement ? nextRepSerial : null,
        replacementXeroFixedAssetNumber: nextReplacement ? nextRepXero : null,
      },
    });
  } catch (e) {
    // Stale Prisma client / missing columns must not block PDF download.
    console.warn(
      "reconcileCertificateFromAudit update skipped; returning existing certificate",
      e
    );
    return {
      ...cert,
      replacementRequested: nextReplacement,
      replacementNotes: nextReplacement ? nextNotes : cert.replacementNotes,
      assessmentReference: nextAssessment,
      fromStatusCode: nextFrom,
      reason: nextReason,
      xeroFixedAssetNumber: nextXero ?? cert.xeroFixedAssetNumber ?? null,
      replacementAssetName: nextReplacement
        ? nextRepName
        : cert.replacementAssetName,
      replacementAssetType: nextReplacement
        ? nextRepType
        : cert.replacementAssetType,
      replacementMakeModel: nextReplacement
        ? nextRepMakeModel
        : cert.replacementMakeModel,
      replacementSerialNumber: nextReplacement
        ? nextRepSerial
        : cert.replacementSerialNumber,
      replacementXeroFixedAssetNumber: nextReplacement
        ? nextRepXero
        : cert.replacementXeroFixedAssetNumber,
    };
  }
}

export async function createWriteOffCertificate(params: {
  assetId: string;
  fromStatusCode: string;
  assessmentReference?: string | null;
  reason: string | null;
  xeroFixedAssetNumber?: string | null;
  replacementRequested?: boolean;
  replacementNotes?: string | null;
  replacementAssetName?: string | null;
  replacementAssetType?: string | null;
  replacementMakeModel?: string | null;
  replacementSerialNumber?: string | null;
  replacementXeroFixedAssetNumber?: string | null;
}): Promise<WriteOffCertificateRecord> {
  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: { club: { select: { name: true } } },
  });
  if (!asset) {
    throw new Error("Asset not found for write-off certificate");
  }

  const replacementRequested = params.replacementRequested === true;
  const replacementNotes = replacementRequested
    ? trimOrNull(params.replacementNotes)
    : null;
  const replacementAssetName = replacementRequested
    ? trimOrNull(params.replacementAssetName)
    : null;
  const replacementAssetType = replacementRequested
    ? trimOrNull(params.replacementAssetType)
    : null;
  const replacementMakeModel = replacementRequested
    ? trimOrNull(params.replacementMakeModel)
    : null;
  const replacementSerialNumber = replacementRequested
    ? trimOrNull(params.replacementSerialNumber)
    : null;
  const replacementXeroFixedAssetNumber = replacementRequested
    ? trimOrNull(params.replacementXeroFixedAssetNumber)
    : null;
  const assessmentReference = trimOrNull(params.assessmentReference);
  const reason = trimOrNull(params.reason);
  const xeroFixedAssetNumber = trimOrNull(params.xeroFixedAssetNumber);

  const existing = await prisma.writeOffCertificate.findFirst({
    where: { assetId: params.assetId },
    orderBy: { writtenOffAt: "desc" },
  });
  if (existing) {
    return prisma.writeOffCertificate.update({
      where: { id: existing.id },
      data: {
        assessmentReference:
          assessmentReference ?? existing.assessmentReference,
        assetName: asset.assetName,
        clubName: asset.club?.name ?? existing.clubName,
        category: asset.category,
        manufacturer: asset.manufacturer,
        model: asset.model,
        serialNumber: asset.serialNumber,
        xeroFixedAssetNumber:
          xeroFixedAssetNumber ?? existing.xeroFixedAssetNumber,
        reason: reason ?? existing.reason,
        replacementRequested:
          replacementRequested || existing.replacementRequested,
        replacementNotes: replacementRequested
          ? replacementNotes
          : existing.replacementRequested
            ? existing.replacementNotes
            : null,
        replacementAssetName: replacementRequested
          ? replacementAssetName
          : existing.replacementRequested
            ? existing.replacementAssetName
            : null,
        replacementAssetType: replacementRequested
          ? replacementAssetType
          : existing.replacementRequested
            ? existing.replacementAssetType
            : null,
        replacementMakeModel: replacementRequested
          ? replacementMakeModel
          : existing.replacementRequested
            ? existing.replacementMakeModel
            : null,
        replacementSerialNumber: replacementRequested
          ? replacementSerialNumber
          : existing.replacementRequested
            ? existing.replacementSerialNumber
            : null,
        replacementXeroFixedAssetNumber: replacementRequested
          ? replacementXeroFixedAssetNumber
          : existing.replacementRequested
            ? existing.replacementXeroFixedAssetNumber
            : null,
        fromStatusCode:
          params.fromStatusCode !== "written_off"
            ? params.fromStatusCode
            : existing.fromStatusCode,
      },
    });
  }

  const referenceNumber = newWriteOffCertificateReference();
  const writtenOffAt = new Date();

  return prisma.writeOffCertificate.create({
    data: {
      assetId: params.assetId,
      referenceNumber,
      assessmentReference,
      assetName: asset.assetName,
      clubName: asset.club?.name ?? null,
      category: asset.category,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serialNumber: asset.serialNumber,
      xeroFixedAssetNumber,
      reason,
      replacementRequested,
      replacementNotes,
      replacementAssetName,
      replacementAssetType,
      replacementMakeModel,
      replacementSerialNumber,
      replacementXeroFixedAssetNumber,
      fromStatusCode: params.fromStatusCode,
      writtenOffAt,
    },
  });
}

/** Ensure a certificate exists for a written-off asset (creates one for legacy rows). */
export async function ensureWriteOffCertificateForAsset(
  assetId: string
): Promise<WriteOffCertificateRecord | null> {
  const existing = await prisma.writeOffCertificate.findFirst({
    where: { assetId },
    orderBy: { writtenOffAt: "desc" },
  });
  if (existing) {
    return reconcileCertificateFromAudit(existing);
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { status: true, club: { select: { name: true } } },
  });
  if (!asset || asset.status.code !== "written_off") return null;

  const hints = await writeOffAuditHints(assetId);
  return createWriteOffCertificate({
    assetId,
    fromStatusCode: hints.fromStatusCode || "written_off",
    assessmentReference: hints.assessmentReference,
    reason: asset.reason ?? hints.reason,
    xeroFixedAssetNumber: hints.xeroFixedAssetNumber,
    replacementRequested: hints.replacementRequested,
    replacementNotes: hints.replacementNotes,
    replacementAssetName: hints.replacementAssetName,
    replacementAssetType: hints.replacementAssetType,
    replacementMakeModel: hints.replacementMakeModel,
    replacementSerialNumber: hints.replacementSerialNumber,
    replacementXeroFixedAssetNumber: hints.replacementXeroFixedAssetNumber,
  });
}

export async function renderWriteOffCertificatePdfForRecord(
  cert: WriteOffCertificateRecord
): Promise<Buffer> {
  const logo = await loadLogoForPdf();
  return renderWriteOffCertificatePdf(
    {
      referenceNumber: cert.referenceNumber,
      writtenOffAt: formatWrittenOffAt(cert.writtenOffAt),
      assetName: cert.assetName,
      clubName: cert.clubName,
      category: cert.category,
      manufacturer: cert.manufacturer,
      model: cert.model,
      serialNumber: cert.serialNumber,
      xeroFixedAssetNumber: cert.xeroFixedAssetNumber ?? null,
      reason: cert.reason,
      assessmentReference: cert.assessmentReference,
      replacementRequested: Boolean(cert.replacementRequested),
      replacementAssetName: cert.replacementAssetName ?? null,
      replacementAssetType: cert.replacementAssetType ?? null,
      replacementMakeModel: cert.replacementMakeModel ?? null,
      replacementSerialNumber: cert.replacementSerialNumber ?? null,
      replacementXeroFixedAssetNumber:
        cert.replacementXeroFixedAssetNumber ?? null,
      replacementNotes: cert.replacementNotes,
      fromStatusLabel: dispatchFromStatusLabel(cert.fromStatusCode),
    },
    logo
  );
}
