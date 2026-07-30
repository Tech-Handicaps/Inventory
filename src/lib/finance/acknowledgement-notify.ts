import {
  financeRecipientsList,
  getEmailNotificationSettings,
  isSenderConfiguredForTransport,
} from "@/lib/email/email-settings";
import { sendPersonalizedFinanceEmails } from "@/lib/email/send-personalized-finance";
import {
  buildInAssessmentEmail,
  buildInRepairEmail,
  buildRefurbishedEmail,
  buildWrittenOffEmail,
} from "@/lib/email/templates/hna-finance-email";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
  );
}

/**
 * Persist finance acknowledgement rows for Assessment using SQL inserts/lookups so this path
 * still works when @prisma/client is stale on Windows (e.g. EPERM during prisma generate while
 * npm run dev holds query_engine-windows.dll.node). Prisma validates create() payloads against the
 * local generated client shape; raw SQL aligns with Postgres only.
 */
async function upsertFinanceAckRowForAssessment(params: {
  assetId: string;
  assessmentId: string;
  referenceNumber: string;
}): Promise<string> {
  const existing = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "FinanceAcknowledgement"
      WHERE "assessmentId" = ${params.assessmentId}
      LIMIT 1
    `
  );

  const first = existing[0];
  if (first?.id) return first.id;

  const id = randomUUID();
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "FinanceAcknowledgement" (
        "id",
        "assetId",
        "eventType",
        "status",
        "referenceText",
        "assessmentId",
        "createdAt"
      )
      VALUES (
        ${id},
        ${params.assetId},
        'in_assessment',
        'pending',
        ${params.referenceNumber},
        ${params.assessmentId},
        NOW()
      )
    `
  );
  return id;
}

export async function createRepairAcknowledgementAndNotify(params: {
  assetId: string;
  repairId: string;
  referenceNumber: string;
}): Promise<void> {
  const settings = await getEmailNotificationSettings();
  if (!settings.notifyOnRepair) return;

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: {
      assetName: true,
      category: true,
      serialNumber: true,
      manufacturer: true,
      model: true,
      club: { select: { name: true } },
    },
  });
  if (!asset) return;

  const ack = await prisma.financeAcknowledgement.create({
    data: {
      assetId: params.assetId,
      eventType: "in_repair",
      status: "pending",
      referenceText: params.referenceNumber,
      repairId: params.repairId,
    },
  });

  if (!settings.sendEnabled) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "send_disabled_in_settings" },
    });
    return;
  }

  const recipients = financeRecipientsList(settings);
  if (recipients.length === 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "no_finance_emails_configured" },
    });
    return;
  }

  const sender = isSenderConfiguredForTransport(settings);
  if (!sender.ok) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: sender.reason },
    });
    return;
  }

  if (!settings.fromAddress.includes("@")) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "from_email_not_configured" },
    });
    return;
  }

  const result = await sendPersonalizedFinanceEmails(
    settings,
    recipients,
    (greeting) =>
      buildInRepairEmail({
        greeting,
        assetName: asset.assetName,
        clubName: asset.club?.name ?? null,
        serial: asset.serialNumber,
        category: asset.category,
        manufacturer: asset.manufacturer,
        model: asset.model,
        repairReference: params.referenceNumber,
        appUrl: appBaseUrl(),
      })
  );

  if (result.sent > 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: {
        emailSentAt: new Date(),
        emailError:
          result.failed > 0
            ? (result.lastError ?? "partial_send_failure").slice(0, 500)
            : null,
      },
    });
  } else {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: {
        emailError: (result.lastError ?? "All sends failed").slice(0, 500),
      },
    });
  }
}

export async function createAssessmentAcknowledgementAndNotify(params: {
  assetId: string;
  assessmentId: string;
  referenceNumber: string;
}): Promise<void> {
  const settings = await getEmailNotificationSettings();

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: {
      assetName: true,
      category: true,
      serialNumber: true,
      manufacturer: true,
      model: true,
      club: { select: { name: true } },
    },
  });
  if (!asset) return;

  const ackId = await upsertFinanceAckRowForAssessment(params);

  if (!settings.notifyOnAssessment) {
    await prisma.financeAcknowledgement.update({
      where: { id: ackId },
      data: { emailSkippedReason: "notify_on_assessment_disabled" },
    });
    return;
  }

  if (!settings.sendEnabled) {
    await prisma.financeAcknowledgement.update({
      where: { id: ackId },
      data: { emailSkippedReason: "send_disabled_in_settings" },
    });
    return;
  }

  const recipients = financeRecipientsList(settings);
  if (recipients.length === 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ackId },
      data: { emailSkippedReason: "no_finance_emails_configured" },
    });
    return;
  }

  const sender = isSenderConfiguredForTransport(settings);
  if (!sender.ok) {
    await prisma.financeAcknowledgement.update({
      where: { id: ackId },
      data: { emailSkippedReason: sender.reason },
    });
    return;
  }

  if (!settings.fromAddress.includes("@")) {
    await prisma.financeAcknowledgement.update({
      where: { id: ackId },
      data: { emailSkippedReason: "from_email_not_configured" },
    });
    return;
  }

  const result = await sendPersonalizedFinanceEmails(
    settings,
    recipients,
    (greeting) =>
      buildInAssessmentEmail({
        greeting,
        assetName: asset.assetName,
        clubName: asset.club?.name ?? null,
        serial: asset.serialNumber,
        category: asset.category,
        manufacturer: asset.manufacturer,
        model: asset.model,
        assessmentReference: params.referenceNumber,
        appUrl: appBaseUrl(),
      })
  );

  if (result.sent > 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ackId },
      data: {
        emailSentAt: new Date(),
        emailError:
          result.failed > 0
            ? (result.lastError ?? "partial_send_failure").slice(0, 500)
            : null,
      },
    });
  } else {
    await prisma.financeAcknowledgement.update({
      where: { id: ackId },
      data: {
        emailError: (result.lastError ?? "All sends failed").slice(0, 500),
      },
    });
  }
}

export async function createWrittenOffAcknowledgementAndNotify(params: {
  assetId: string;
  reason: string | null;
  xeroFixedAssetNumber?: string | null;
  replacementRequested?: boolean;
  replacementNotes?: string | null;
  replacementAssetName?: string | null;
  replacementAssetType?: string | null;
  replacementMakeModel?: string | null;
  replacementSerialNumber?: string | null;
  replacementXeroFixedAssetNumber?: string | null;
  assessmentReference?: string | null;
  writeOffCertificateId?: string | null;
  writeOffCertificateReference?: string | null;
}): Promise<void> {
  const settings = await getEmailNotificationSettings();
  if (!settings.notifyOnWrittenOff) return;

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: {
      assetName: true,
      category: true,
      serialNumber: true,
      manufacturer: true,
      model: true,
      club: { select: { name: true } },
    },
  });
  if (!asset) return;

  const certRef = params.writeOffCertificateReference?.trim() || null;
  const refParts = [
    certRef,
    params.assessmentReference?.trim()
      ? `From ${params.assessmentReference.trim()}`
      : null,
    params.reason?.trim() || null,
    params.replacementRequested ? "Replacement requested" : null,
  ].filter(Boolean);
  const ref =
    refParts.join(" · ").slice(0, 500) ||
    `Written off — ${asset.assetName}`;

  const ack = await prisma.financeAcknowledgement.create({
    data: {
      assetId: params.assetId,
      eventType: "written_off",
      status: "pending",
      referenceText: ref.slice(0, 500),
      ...(params.writeOffCertificateId
        ? { writeOffCertificateId: params.writeOffCertificateId }
        : {}),
    },
  });

  if (!settings.sendEnabled) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "send_disabled_in_settings" },
    });
    return;
  }

  const recipients = financeRecipientsList(settings);
  if (recipients.length === 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "no_finance_emails_configured" },
    });
    return;
  }

  const sender = isSenderConfiguredForTransport(settings);
  if (!sender.ok) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: sender.reason },
    });
    return;
  }

  if (!settings.fromAddress.includes("@")) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "from_email_not_configured" },
    });
    return;
  }

  let attachments:
    | { filename: string; content: Buffer; contentType: string }[]
    | undefined;
  if (params.writeOffCertificateId) {
    try {
      const cert = await prisma.writeOffCertificate.findUnique({
        where: { id: params.writeOffCertificateId },
      });
      if (cert) {
        const { renderWriteOffCertificatePdfForRecord } = await import(
          "@/lib/finance/write-off-certificate"
        );
        const pdfBuffer = await renderWriteOffCertificatePdfForRecord(cert);
        attachments = [
          {
            filename: `${cert.referenceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ];
      }
    } catch (e) {
      console.error("write-off certificate PDF attach failed", e);
    }
  }

  const result = await sendPersonalizedFinanceEmails(
    settings,
    recipients,
    (greeting) =>
      buildWrittenOffEmail({
        greeting,
        assetName: asset.assetName,
        clubName: asset.club?.name ?? null,
        serial: asset.serialNumber,
        category: asset.category,
        manufacturer: asset.manufacturer,
        model: asset.model,
        reason: params.reason?.trim() ?? null,
        assessmentReference: params.assessmentReference?.trim() ?? null,
        writeOffCertificateReference: certRef,
        xeroFixedAssetNumber: params.xeroFixedAssetNumber?.trim() ?? null,
        replacementRequested: params.replacementRequested === true,
        replacementAssetName: params.replacementAssetName?.trim() ?? null,
        replacementAssetType: params.replacementAssetType?.trim() ?? null,
        replacementMakeModel: params.replacementMakeModel?.trim() ?? null,
        replacementSerialNumber: params.replacementSerialNumber?.trim() ?? null,
        replacementXeroFixedAssetNumber:
          params.replacementXeroFixedAssetNumber?.trim() ?? null,
        replacementNotes: params.replacementNotes?.trim() ?? null,
        appUrl: appBaseUrl(),
      }),
    { attachments }
  );

  if (result.sent > 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: {
        emailSentAt: new Date(),
        emailError:
          result.failed > 0
            ? (result.lastError ?? "partial_send_failure").slice(0, 500)
            : null,
      },
    });
  } else {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: {
        emailError: (result.lastError ?? "All sends failed").slice(0, 500),
      },
    });
  }
}

function formatBookedAt(d: Date): string {
  return d.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGeoLabel(parts: {
  geoRegionName: string | null;
  geoCity: string | null;
  geoCountryCode: string | null;
}): string | null {
  const label = [parts.geoRegionName, parts.geoCity, parts.geoCountryCode]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .join(" · ");
  return label || null;
}

/**
 * Finance acknowledgement + email when Assessment/Maintenance → Refurbished
 * (booked into refurbishment, ready for redistribution).
 */
export async function createRefurbishedAcknowledgementAndNotify(params: {
  assetId: string;
  assessmentReference?: string | null;
  /** Club of origin — pass explicitly because clubId is cleared on the asset. */
  fromClubName?: string | null;
}): Promise<void> {
  const settings = await getEmailNotificationSettings();

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: {
      club: { select: { name: true } },
      deviceTemplate: { select: { label: true } },
    },
  });
  if (!asset) return;

  const assessmentRef = params.assessmentReference?.trim() || null;
  const clubName =
    params.fromClubName?.trim() ||
    asset.club?.name?.trim() ||
    null;
  const refParts = [
    assessmentRef,
    clubName ? `From ${clubName}` : null,
    "Booked into refurbished — ready for redistribution",
  ].filter(Boolean);
  const ref =
    refParts.join(" · ").slice(0, 500) ||
    `Refurbished — ${asset.assetName}`;

  const ack = await prisma.financeAcknowledgement.create({
    data: {
      assetId: params.assetId,
      eventType: "refurbished",
      status: "pending",
      referenceText: ref.slice(0, 500),
    },
  });

  if (!settings.notifyOnRefurbished) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "notify_on_refurbished_disabled" },
    });
    return;
  }

  if (!settings.sendEnabled) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "send_disabled_in_settings" },
    });
    return;
  }

  const recipients = financeRecipientsList(settings);
  if (recipients.length === 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "no_finance_emails_configured" },
    });
    return;
  }

  const sender = isSenderConfiguredForTransport(settings);
  if (!sender.ok) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: sender.reason },
    });
    return;
  }

  if (!settings.fromAddress.includes("@")) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "from_email_not_configured" },
    });
    return;
  }

  const result = await sendPersonalizedFinanceEmails(
    settings,
    recipients,
    (greeting) =>
      buildRefurbishedEmail({
        greeting,
        assetName: asset.assetName,
        clubName,
        serial: asset.serialNumber,
        category: asset.category,
        manufacturer: asset.manufacturer,
        model: asset.model,
        deviceLocation: asset.deviceLocation,
        templateLabel: asset.deviceTemplate?.label ?? null,
        processorName: asset.processorName,
        systemRam: asset.systemRam,
        systemGpu: asset.systemGpu,
        publicIp: asset.publicIp,
        geoLabel: formatGeoLabel(asset),
        zohoAssistDeviceId: asset.zohoAssistDeviceId,
        dataSource: asset.dataSource,
        assessmentReference: assessmentRef,
        bookedAt: formatBookedAt(new Date()),
        appUrl: appBaseUrl(),
      })
  );

  if (result.sent > 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: {
        emailSentAt: new Date(),
        emailError:
          result.failed > 0
            ? (result.lastError ?? "partial_send_failure").slice(0, 500)
            : null,
      },
    });
  } else {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: {
        emailError: (result.lastError ?? "All sends failed").slice(0, 500),
      },
    });
  }
}
