import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { createAssessmentAcknowledgementAndNotify } from "@/lib/finance/acknowledgement-notify";
import { prisma } from "@/lib/prisma";
import {
  createDeskTicket as createZohoDeskTicket,
  normalizeDeskTicketLookup,
  postDeskInternalCommentByLookup,
} from "@/lib/zoho/desk";

function newAssessmentReference(): string {
  const y = new Date().getFullYear();
  return `HNA-ASM-${y}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// GET /api/assessments?assetId=…
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const assetId = request.nextUrl.searchParams.get("assetId");
    const where =
      typeof assetId === "string" && assetId.trim()
        ? { assetId: assetId.trim() }
        : {};
    const items = await prisma.assessment.findMany({
      where,
      include: {
        asset: { select: { id: true, assetName: true, status: true } },
        repairs: { select: { id: true, referenceNumber: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(items);
  } catch (e) {
    console.error("GET /api/assessments", e);
    return NextResponse.json({ error: "Failed to fetch assessments" }, { status: 500 });
  }
}

// POST /api/assessments — Deployed asset → Assessment + optional Desk + finance ack
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const assetId =
      typeof body.assetId === "string" ? body.assetId.trim() : "";
    const intakeNotes =
      typeof body.intakeNotes === "string" ? body.intakeNotes.trim() || null : null;
    const createDeskTicket = body.createDeskTicket === true;
    const existingDeskRaw =
      typeof body.existingDeskTicket === "string" ? body.existingDeskTicket : "";
    const existingDeskLookup = normalizeDeskTicketLookup(existingDeskRaw);

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { status: true, club: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (asset.status.code !== "deployed") {
      return NextResponse.json(
        {
          error:
            "Only assets in Deployed can start Assessment/Maintenance (use Log repair from depot stock when no triage step is needed).",
        },
        { status: 400 }
      );
    }

    const dup = await prisma.assessment.findFirst({
      where: { assetId, workflowStatus: "open" },
    });
    if (dup) {
      return NextResponse.json(
        {
          error: `This asset already has an open Assessment/Maintenance intake (${dup.referenceNumber}).`,
        },
        { status: 409 }
      );
    }

    const assessmentStatusRow = await prisma.assetStatus.findFirst({
      where: { code: "assessment" },
    });
    if (!assessmentStatusRow) {
      return NextResponse.json(
        { error: "Assessment/Maintenance lifecycle status missing — run db seed." },
        { status: 500 }
      );
    }

    let zohoDeskTicketId: string | null = null;
    let zohoDeskTicketNumber: string | null = null;

    const referenceNumber = newAssessmentReference();

    if (existingDeskLookup.length > 0 && createDeskTicket) {
      return NextResponse.json(
        { error: "Choose either an existing Desk ticket or create a new one, not both." },
        { status: 400 }
      );
    }

    const deskHtmlIntro = `<p><strong>Inventory Assessment/Maintenance</strong> ${escapeHtml(referenceNumber)}.</p>
<p><strong>Asset:</strong> ${escapeHtml(asset.assetName)}</p>`;

    try {
      if (existingDeskLookup.length > 0) {
        const noteBlock =
          intakeNotes != null && intakeNotes.length > 0
            ? `<p><strong>Intake notes:</strong></p><p>${escapeHtml(intakeNotes).replace(/\n/g, "<br/>")}</p>`
            : "";

        const resDesk = await postDeskInternalCommentByLookup(
          existingDeskLookup,
          `${deskHtmlIntro}${noteBlock}`
        );
        zohoDeskTicketId = resDesk.ticketId;
        zohoDeskTicketNumber = resDesk.ticketNumber;
      } else if (createDeskTicket) {
        const html = [
          deskHtmlIntro,
          asset.serialNumber ? `<p><strong>Serial:</strong> ${escapeHtml(asset.serialNumber)}</p>` : "",
          asset.manufacturer || asset.model
            ? `<p><strong>Make / model:</strong> ${escapeHtml([asset.manufacturer, asset.model].filter(Boolean).join(" "))}</p>`
            : "",
          intakeNotes ? `<p><strong>Notes:</strong> ${escapeHtml(intakeNotes)}</p>` : "",
          `<p>${escapeHtml(asset.club?.name ? `Club: ${asset.club.name}` : "")}</p>`,
        ]
          .filter(Boolean)
          .join("");

        const desk = await createZohoDeskTicket({
          subject: `Assessment/Maintenance · ${referenceNumber} · ${asset.assetName}`,
          description: html,
        });
        zohoDeskTicketId = desk.ticketId;
        zohoDeskTicketNumber = desk.ticketNumber;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Desk operation failed";
      return NextResponse.json({ error: `Zoho Desk: ${msg}` }, { status: 502 });
    }

    const assessment = await prisma.$transaction(async (tx) => {
      const a = await tx.assessment.create({
        data: {
          assetId,
          referenceNumber,
          workflowStatus: "open",
          intakeNotes,
          zohoDeskTicketId,
          zohoDeskTicketNumber,
        },
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { statusId: assessmentStatusRow.id },
      });
      return a;
    });

    await createAuditLog({
      userId: user.id,
      actionType: "assessment.created",
      notes: `Assessment/Maintenance intake ${referenceNumber} for ${asset.assetName}`,
      metadata: {
        assessmentId: assessment.id,
        referenceNumber,
        assetId,
        zohoDeskTicketId,
      },
    });

    try {
      await createAssessmentAcknowledgementAndNotify({
        assetId,
        assessmentId: assessment.id,
        referenceNumber,
      });
    } catch (e) {
      console.error("createAssessmentAcknowledgementAndNotify", e);
    }

    return NextResponse.json(assessment);
  } catch (e) {
    console.error("POST /api/assessments", e);
    return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 });
  }
}
