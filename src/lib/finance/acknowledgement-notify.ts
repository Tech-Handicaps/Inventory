import {
  financeRecipientEmails,
  getEmailNotificationSettings,
  isSenderConfiguredForTransport,
} from "@/lib/email/email-settings";
import { sendHtmlEmailUnified } from "@/lib/email/send-html-email";
import {
  buildInRepairEmail,
  buildWrittenOffEmail,
  greetingLine,
} from "@/lib/email/templates/hna-finance-email";
import { prisma } from "@/lib/prisma";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000"
  );
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

  const recipients = financeRecipientEmails(settings);
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

  const greeting = greetingLine(settings.financeGreetingName);
  const { subject, html } = buildInRepairEmail({
    greeting,
    assetName: asset.assetName,
    serial: asset.serialNumber,
    category: asset.category,
    repairReference: params.referenceNumber,
    appUrl: appBaseUrl(),
  });

  const result = await sendHtmlEmailUnified(settings, {
    to: recipients,
    subject,
    html,
    from: settings.fromAddress,
    replyTo: settings.replyTo,
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
}

export async function createWrittenOffAcknowledgementAndNotify(params: {
  assetId: string;
  reason: string | null;
}): Promise<void> {
  const settings = await getEmailNotificationSettings();
  if (!settings.notifyOnWrittenOff) return;

  const asset = await prisma.asset.findUnique({
    where: { id: params.assetId },
    select: {
      assetName: true,
      category: true,
      serialNumber: true,
    },
  });
  if (!asset) return;

  const ref =
    params.reason?.trim() ||
    `Written off — ${asset.assetName}`;

  const ack = await prisma.financeAcknowledgement.create({
    data: {
      assetId: params.assetId,
      eventType: "written_off",
      status: "pending",
      referenceText: ref.slice(0, 500),
    },
  });

  if (!settings.sendEnabled) {
    await prisma.financeAcknowledgement.update({
      where: { id: ack.id },
      data: { emailSkippedReason: "send_disabled_in_settings" },
    });
    return;
  }

  const recipients = financeRecipientEmails(settings);
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

  const greeting = greetingLine(settings.financeGreetingName);
  const { subject, html } = buildWrittenOffEmail({
    greeting,
    assetName: asset.assetName,
    serial: asset.serialNumber,
    category: asset.category,
    reason: params.reason?.trim() ?? null,
    appUrl: appBaseUrl(),
  });

  const result = await sendHtmlEmailUnified(settings, {
    to: recipients,
    subject,
    html,
    from: settings.fromAddress,
    replyTo: settings.replyTo,
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
}
