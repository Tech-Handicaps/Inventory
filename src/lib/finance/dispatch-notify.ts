import {
  financeRecipientEmails,
  getEmailNotificationSettings,
  isSenderConfiguredForTransport,
} from "@/lib/email/email-settings";
import { sendHtmlEmailUnified } from "@/lib/email/send-html-email";
import {
  buildDispatchVoucherEmail,
  greetingLine,
} from "@/lib/email/templates/hna-finance-email";
import {
  dispatchFromStatusLabel,
  newDispatchVoucherReference,
  shouldIssueDispatchVoucher,
} from "@/lib/finance/dispatch-reference";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderDispatchVoucherPdf } from "@/lib/pdf/render-dispatch-voucher-pdf";
import { prisma } from "@/lib/prisma";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
  );
}

function formatDispatchDate(d: Date): string {
  return d.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export { shouldIssueDispatchVoucher };

/**
 * Creates a dispatch voucher, finance acknowledgement row, PDF, and emails finance
 * when hardware moves from Assessment/Maintenance or In Repairs → Deployed.
 */
export async function createDispatchVoucherAndNotify(params: {
  assetId: string;
  fromStatusCode: string;
}): Promise<{ referenceNumber: string } | null> {
  if (
    !shouldIssueDispatchVoucher(params.fromStatusCode, "deployed")
  ) {
    return null;
  }

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    include: {
      club: { select: { name: true } },
      deviceTemplate: { select: { label: true } },
    },
  });
  if (!asset) return null;

  const referenceNumber = newDispatchVoucherReference();
  const dispatchedAt = new Date();
  const fromStageLabel = dispatchFromStatusLabel(params.fromStatusCode);

  const voucher = await prisma.dispatchVoucher.create({
    data: {
      assetId: params.assetId,
      referenceNumber,
      fromStatusCode: params.fromStatusCode,
      clubName: asset.club?.name ?? null,
      deviceLocation: asset.deviceLocation,
      dispatchedAt,
    },
  });

  const ack = await prisma.financeAcknowledgement.create({
    data: {
      assetId: params.assetId,
      eventType: "dispatched",
      status: "pending",
      referenceText: referenceNumber,
      dispatchVoucherId: voucher.id,
    },
  });

  const settings = await getEmailNotificationSettings();

  if (!settings.notifyOnDispatch) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "notify_on_dispatch_disabled" },
    });
    return { referenceNumber };
  }

  if (!settings.sendEnabled) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "send_disabled_in_settings" },
    });
    return { referenceNumber };
  }

  const recipients = financeRecipientEmails(settings);
  if (recipients.length === 0) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "no_finance_emails_configured" },
    });
    return { referenceNumber };
  }

  const sender = isSenderConfiguredForTransport(settings);
  if (!sender.ok) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: sender.reason },
    });
    return { referenceNumber };
  }

  if (!settings.fromAddress.includes("@")) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "from_email_not_configured" },
    });
    return { referenceNumber };
  }

  const dispatchedAtLabel = formatDispatchDate(dispatchedAt);
  const logoSource = await loadLogoForPdf();
  const pdfBuffer = await renderDispatchVoucherPdf(
    {
      referenceNumber,
      dispatchedAt: dispatchedAtLabel,
      fromStageLabel,
      assetName: asset.assetName,
      clubName: asset.club?.name ?? null,
      category: asset.category,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serialNumber: asset.serialNumber,
      deviceLocation: asset.deviceLocation,
      templateLabel: asset.deviceTemplate?.label ?? null,
      processorName: asset.processorName,
      systemRam: asset.systemRam,
      systemGpu: asset.systemGpu,
      dataSource: asset.dataSource,
    },
    logoSource
  );

  const greeting = greetingLine(settings.financeGreetingName);
  const { subject, html } = buildDispatchVoucherEmail({
    greeting,
    voucherReference: referenceNumber,
    fromStageLabel,
    assetName: asset.assetName,
    clubName: asset.club?.name ?? null,
    serial: asset.serialNumber,
    category: asset.category,
    manufacturer: asset.manufacturer,
    model: asset.model,
    deviceLocation: asset.deviceLocation,
    templateLabel: asset.deviceTemplate?.label ?? null,
    processorName: asset.processorName,
    systemRam: asset.systemRam,
    systemGpu: asset.systemGpu,
    dataSource: asset.dataSource,
    dispatchedAt: dispatchedAtLabel,
    appUrl: appBaseUrl(),
  });

  const pdfFilename = `${referenceNumber}.pdf`;
  const result = await sendHtmlEmailUnified(settings, {
    to: recipients,
    subject,
    html,
    from: settings.fromAddress,
    replyTo: settings.replyTo,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (result.ok) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSentAt: new Date(), emailError: null },
    });
  } else {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailError: result.error.slice(0, 500) },
    });
  }

  return { referenceNumber };
}
