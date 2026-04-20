import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireFinanceAckUser } from "@/lib/auth/require-finance-user";
import { nextResponseIfPrismaSchemaDrift } from "@/lib/prisma-error-response";
import { prisma } from "@/lib/prisma";

/** PATCH — acknowledge a finance item (in-app checkbox). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFinanceAckUser(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: { acknowledgedNote?: unknown };
  try {
    body = (await request.json()) as { acknowledgedNote?: unknown };
  } catch {
    body = {};
  }
  const note =
    typeof body.acknowledgedNote === "string"
      ? body.acknowledgedNote.trim().slice(0, 2000) || null
      : null;

  try {
    const existing = await prisma.financeAcknowledgement.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.status === "acknowledged") {
      return NextResponse.json({ error: "Already acknowledged" }, { status: 400 });
    }

    const updated = await prisma.financeAcknowledgement.update({
      where: { id },
      data: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedByUserId: user.id,
        acknowledgedNote: note,
      },
      include: {
        asset: { select: { assetName: true } },
      },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "finance.acknowledgement",
      notes: `Acknowledged ${updated.eventType} · ${updated.asset.assetName}`,
      metadata: {
        acknowledgementId: id,
        eventType: updated.eventType,
        assetId: updated.assetId,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    const drift = nextResponseIfPrismaSchemaDrift(e);
    if (drift) return drift;
    console.error("PATCH /api/finance/acknowledgements/[id]", e);
    return NextResponse.json(
      { error: "Failed to acknowledge" },
      { status: 500 }
    );
  }
}
