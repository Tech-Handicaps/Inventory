import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  appendDeskInternalCommentForTicket,
  createDeskTicketForRepair,
  linkRepairNotesToDeskTicket,
  normalizeDeskTicketLookup,
} from "@/lib/zoho/desk";
import { createRepairAcknowledgementAndNotify } from "@/lib/finance/acknowledgement-notify";
import { prisma } from "@/lib/prisma";

function newRepairReference(): string {
  const y = new Date().getFullYear();
  return `HNA-REP-${y}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

// POST /api/repairs - Create repair (+ optional Zoho Desk ticket, optional move asset to repair stage)
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
    const assessmentIdRaw =
      typeof body.assessmentId === "string" ? body.assessmentId.trim() : "";
    const technicianNotes =
      typeof body.technicianNotes === "string" ? body.technicianNotes : undefined;
    const repairStatus =
      typeof body.repairStatus === "string" ? body.repairStatus : "pending";
    const createDeskTicket = body.createDeskTicket === true;
    const moveAssetToRepairStage = body.moveAssetToRepairStage !== false;
    const existingDeskTicketRaw =
      typeof body.existingDeskTicket === "string" ? body.existingDeskTicket : "";
    const existingDeskLookup = normalizeDeskTicketLookup(existingDeskTicketRaw);

    if (!assetId) {
      return NextResponse.json(
        { error: "assetId is required" },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { status: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (asset.status.code === "deployed") {
      return NextResponse.json(
        {
          error:
            "Use Send for Assessment/Maintenance first for deployed hardware, then Log repair after triage if needed.",
        },
        { status: 400 }
      );
    }

    let assessmentRow: {
      id: string;
      assetId: string;
      workflowStatus: string;
      referenceNumber: string;
      zohoDeskTicketId: string | null;
      zohoDeskTicketNumber: string | null;
    } | null = null;

    if (asset.status.code === "assessment") {
      if (!assessmentIdRaw) {
        return NextResponse.json(
          {
            error:
              "assessmentId is required — open Log repair from the Assessment/Maintenance card so the intake is completed correctly.",
          },
          { status: 400 }
        );
      }
      const row = await prisma.assessment.findUnique({
        where: { id: assessmentIdRaw },
        select: {
          id: true,
          assetId: true,
          workflowStatus: true,
          referenceNumber: true,
          zohoDeskTicketId: true,
          zohoDeskTicketNumber: true,
        },
      });
      if (!row || row.assetId !== assetId) {
        return NextResponse.json(
          { error: "Assessment/Maintenance intake not found for this asset." },
          { status: 400 }
        );
      }
      if (row.workflowStatus !== "open") {
        return NextResponse.json(
          {
            error: `That intake is no longer open (${row.referenceNumber}).`,
          },
          { status: 400 }
        );
      }
      assessmentRow = row;
    } else if (assessmentIdRaw) {
      return NextResponse.json(
        {
          error:
            "assessmentId is only used when the asset is in the Assessment/Maintenance stage.",
        },
        { status: 400 }
      );
    }

    let zohoDeskTicketId: string | null = null;
    let zohoDeskTicketNumber: string | null = null;

    const referenceNumber = newRepairReference();

    if (existingDeskLookup.length > 0) {
      try {
        const desk = await linkRepairNotesToDeskTicket({
          referenceNumber,
          assetName: asset.assetName,
          serialNumber: asset.serialNumber,
          technicianNotes: technicianNotes ?? null,
          manufacturer: asset.manufacturer,
          model: asset.model,
          lookup: existingDeskLookup,
        });
        zohoDeskTicketId = desk.ticketId;
        zohoDeskTicketNumber = desk.ticketNumber;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Desk link failed";
        return NextResponse.json(
          { error: `Zoho Desk: ${msg}` },
          { status: 502 }
        );
      }
    } else if (createDeskTicket) {
      try {
        const subject = `Hardware repair · ${referenceNumber} · ${asset.assetName}`;
        const description = [
          `<p><strong>Inventory reference:</strong> ${referenceNumber}</p>`,
          ...(assessmentRow
            ? [
                `<p><strong>From Assessment/Maintenance:</strong> ${escapeHtml(assessmentRow.referenceNumber)}</p>`,
              ]
            : []),
          `<p><strong>Asset:</strong> ${asset.assetName}</p>`,
          asset.serialNumber
            ? `<p><strong>Serial:</strong> ${asset.serialNumber}</p>`
            : "",
          asset.manufacturer || asset.model
            ? `<p><strong>Make / model:</strong> ${[asset.manufacturer, asset.model].filter(Boolean).join(" ")}</p>`
            : "",
          technicianNotes
            ? `<p><strong>Notes:</strong> ${escapeHtml(technicianNotes)}</p>`
            : "",
        ]
          .filter(Boolean)
          .join("");

        const desk = await createDeskTicketForRepair({
          subject,
          description,
          referenceNumber,
        });
        zohoDeskTicketId = desk.ticketId;
        zohoDeskTicketNumber = desk.ticketNumber;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Desk ticket failed";
        return NextResponse.json(
          { error: `Zoho Desk: ${msg}` },
          { status: 502 }
        );
      }
    } else if (
      assessmentRow?.zohoDeskTicketId &&
      assessmentRow.workflowStatus === "open"
    ) {
      zohoDeskTicketId = assessmentRow.zohoDeskTicketId;
      zohoDeskTicketNumber = assessmentRow.zohoDeskTicketNumber;
    }

    /** Link flow and “create ticket” embed notes in Desk already — avoid duplicate comments */
    const deskAlreadyUsedForNotesBody =
      existingDeskLookup.length > 0 || createDeskTicket;

    const notesTrim = technicianNotes?.trim();
    if (notesTrim && zohoDeskTicketId && !deskAlreadyUsedForNotesBody) {
      const htmlParts = [
        `<p><strong>Formal repair started</strong> — ${escapeHtml(referenceNumber)}</p>`,
        assessmentRow
          ? `<p>Continued from Assessment/Maintenance intake <strong>${escapeHtml(assessmentRow.referenceNumber)}</strong>.</p>`
          : "",
        `<p><strong>Technician notes:</strong></p><p>${escapeHtml(notesTrim).replace(/\n/g, "<br/>")}</p>`,
      ].filter(Boolean);
      try {
        await appendDeskInternalCommentForTicket(
          zohoDeskTicketId,
          htmlParts.join("")
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Desk comment failed";
        return NextResponse.json(
          { error: `Zoho Desk: ${msg}` },
          { status: 502 }
        );
      }
    }

    const { repair, movedStatus } = await prisma.$transaction(async (tx) => {
      const r = await tx.repair.create({
        data: {
          assetId,
          referenceNumber,
          repairStatus,
          technicianNotes: technicianNotes ?? null,
          zohoDeskTicketId,
          zohoDeskTicketNumber,
          assessmentId: assessmentRow?.id ?? null,
        },
        include: { asset: { include: { status: true } } },
      });

      if (assessmentRow) {
        await tx.assessment.update({
          where: { id: assessmentRow.id },
          data: {
            workflowStatus: "completed",
            completedAt: new Date(),
          },
        });
      }

      let moved: { from: string; assetName: string } | undefined;

      if (moveAssetToRepairStage) {
        const repairStage = await tx.assetStatus.findFirst({
          where: { code: "repair" },
        });
        if (repairStage && asset.statusId !== repairStage.id) {
          moved = { from: asset.status.code, assetName: asset.assetName };
          await tx.asset.update({
            where: { id: assetId },
            data: { statusId: repairStage.id },
          });
        }
      }

      return { repair: r, movedStatus: moved };
    });

    if (movedStatus) {
      await createAuditLog({
        userId: user.id,
        actionType: "asset.updated",
        notes: `Updated: ${movedStatus.assetName} (repair logged)`,
        metadata: {
          assetId,
          changes: {
            statusCode: {
              from: movedStatus.from,
              to: "repair",
            },
          },
        },
      });
    }

    if (assessmentRow) {
      await createAuditLog({
        userId: user.id,
        actionType: "assessment.completed",
        notes: `Assessment/Maintenance intake ${assessmentRow.referenceNumber} completed via repair ${referenceNumber}`,
        metadata: {
          assessmentId: assessmentRow.id,
          referenceNumber: assessmentRow.referenceNumber,
          repairId: repair.id,
          repairReference: referenceNumber,
          assetId,
        },
      });
    }

    await createAuditLog({
      userId: user.id,
      actionType: "repair.created",
      notes: `Repair ${repair.referenceNumber} for ${repair.asset.assetName}`,
      metadata: {
        repairId: repair.id,
        referenceNumber: repair.referenceNumber,
        assetId: repair.assetId,
        assessmentId: repair.assessmentId,
        repairStatus: repair.repairStatus,
        zohoDeskTicketId: repair.zohoDeskTicketId,
        zohoDeskTicketNumber: repair.zohoDeskTicketNumber,
      },
    });

    try {
      await createRepairAcknowledgementAndNotify({
        assetId,
        repairId: repair.id,
        referenceNumber: repair.referenceNumber,
      });
    } catch (e) {
      console.error("createRepairAcknowledgementAndNotify", e);
    }

    return NextResponse.json(repair);
  } catch (error) {
    console.error("POST /api/repairs", error);
    return NextResponse.json(
      { error: "Failed to create repair" },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// GET /api/repairs - List repairs
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("assetId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (assetId) where.assetId = assetId;
    if (status) where.repairStatus = status;

    const repairs = await prisma.repair.findMany({
      where,
      include: { asset: { include: { status: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(repairs);
  } catch (error) {
    console.error("GET /api/repairs", error);
    return NextResponse.json(
      { error: "Failed to fetch repairs" },
      { status: 500 }
    );
  }
}
