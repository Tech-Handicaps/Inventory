import { dispatchFromStatusLabel } from "@/lib/finance/dispatch-reference";
import { newWriteOffCertificateReference } from "@/lib/finance/write-off-reference";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderWriteOffCertificatePdf } from "@/lib/pdf/write-off-certificate-html";
import { prisma } from "@/lib/prisma";

export type WriteOffCertificateRecord = {
  id: string;
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

  const existing = await prisma.writeOffCertificate.findFirst({
    where: { assetId: params.assetId },
    orderBy: { writtenOffAt: "desc" },
  });
  if (existing) {
    return existing;
  }

  const referenceNumber = newWriteOffCertificateReference();
  const writtenOffAt = new Date();

  return prisma.writeOffCertificate.create({
    data: {
      assetId: params.assetId,
      referenceNumber,
      assessmentReference: params.assessmentReference?.trim() || null,
      assetName: asset.assetName,
      clubName: asset.club?.name ?? null,
      category: asset.category,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serialNumber: asset.serialNumber,
      reason: params.reason?.trim() || null,
      replacementRequested: params.replacementRequested === true,
      replacementNotes:
        params.replacementRequested === true
          ? params.replacementNotes?.trim() || null
          : null,
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
  if (existing) return existing;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { status: true, club: { select: { name: true } } },
  });
  if (!asset || asset.status.code !== "written_off") return null;

  return createWriteOffCertificate({
    assetId,
    fromStatusCode: "written_off",
    reason: asset.reason,
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
      replacementRequested: cert.replacementRequested,
      replacementNotes: cert.replacementNotes,
      fromStatusLabel: dispatchFromStatusLabel(cert.fromStatusCode),
    },
    logo
  );
}
