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
  reason: string | null;
  replacementRequested: boolean;
  replacementNotes: string | null;
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

type WriteOffAuditMeta = {
  replacementRequested?: unknown;
  replacementNotes?: unknown;
  assessmentReference?: unknown;
  fromStatusCode?: unknown;
  writeOffReason?: unknown;
};

async function writeOffAuditHints(assetId: string): Promise<{
  replacementRequested: boolean;
  replacementNotes: string | null;
  assessmentReference: string | null;
  fromStatusCode: string | null;
  reason: string | null;
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
  };
}

/** Fill gaps on an existing certificate from write-off audit / ack text. */
async function reconcileCertificateFromAudit(
  cert: WriteOffCertificateRecord
): Promise<WriteOffCertificateRecord> {
  if (
    cert.replacementRequested &&
    cert.assessmentReference &&
    cert.fromStatusCode !== "written_off"
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

  if (
    nextReplacement === cert.replacementRequested &&
    nextNotes === cert.replacementNotes &&
    nextAssessment === cert.assessmentReference &&
    nextFrom === cert.fromStatusCode &&
    nextReason === cert.reason
  ) {
    return cert;
  }

  return prisma.writeOffCertificate.update({
    where: { id: cert.id },
    data: {
      replacementRequested: nextReplacement,
      replacementNotes: nextReplacement ? nextNotes : null,
      assessmentReference: nextAssessment,
      fromStatusCode: nextFrom,
      reason: nextReason,
    },
  });
}

export async function createWriteOffCertificate(params: {
  assetId: string;
  fromStatusCode: string;
  assessmentReference?: string | null;
  reason: string | null;
  replacementRequested?: boolean;
  replacementNotes?: string | null;
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
    ? params.replacementNotes?.trim() || null
    : null;
  const assessmentReference = params.assessmentReference?.trim() || null;
  const reason = params.reason?.trim() || null;

  const existing = await prisma.writeOffCertificate.findFirst({
    where: { assetId: params.assetId },
    orderBy: { writtenOffAt: "desc" },
  });
  if (existing) {
    // Always refresh snapshot fields from this write-off (fixes stale No / missing intake).
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
        reason: reason ?? existing.reason,
        replacementRequested:
          replacementRequested || existing.replacementRequested,
        replacementNotes:
          replacementRequested
            ? replacementNotes
            : existing.replacementRequested
              ? existing.replacementNotes
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
      reason,
      replacementRequested,
      replacementNotes,
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
    replacementRequested: hints.replacementRequested,
    replacementNotes: hints.replacementNotes,
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
      reason: cert.reason,
      assessmentReference: cert.assessmentReference,
      replacementRequested: Boolean(cert.replacementRequested),
      replacementNotes: cert.replacementNotes,
      fromStatusLabel: dispatchFromStatusLabel(cert.fromStatusCode),
    },
    logo
  );
}
