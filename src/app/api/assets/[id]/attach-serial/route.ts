import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { normaliseSerial } from "@/lib/inventory/scan-code";
import { isMissingSerial } from "@/lib/inventory/scan-lookup";
import { findAssetBySerial } from "@/lib/inventory/serial-lookup";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  serialNumber: z.string().trim().min(1, "serialNumber is required").max(120),
});

/** POST /api/assets/:id/attach-serial — give a scanned serial to a unit that has none yet. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const parsed = await parseJsonBody(request, schema);
    if (isNextResponse(parsed)) return parsed;
    const serial = normaliseSerial(parsed.serialNumber);
    if (!serial) return NextResponse.json({ error: "serialNumber is required" }, { status: 400 });

    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { assetName: true, serialNumber: true },
    });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    if (!isMissingSerial(asset.serialNumber)) {
      return NextResponse.json(
        { error: `${asset.assetName} already has serial ${asset.serialNumber}. Edit the asset to change it.` },
        { status: 409 }
      );
    }
    const duplicate = await findAssetBySerial(serial, id);
    if (duplicate) {
      return NextResponse.json(
        { error: `Serial ${serial} is already on ${duplicate.assetName} (${duplicate.status.label}).` },
        { status: 409 }
      );
    }

    await prisma.asset.update({ where: { id }, data: { serialNumber: serial } });
    await createAuditLog({
      userId: auth.user.id,
      actionType: "asset.serial_attached",
      notes: `Scanned serial ${serial} attached to ${asset.assetName}`,
      metadata: { assetId: id, from: asset.serialNumber, to: serial, via: "scanner" },
    });
    return NextResponse.json({ ok: true, assetId: id, serialNumber: serial });
  } catch (e) {
    return catchToJsonError("POST /api/assets/[id]/attach-serial", e, "Could not attach serial");
  }
}
