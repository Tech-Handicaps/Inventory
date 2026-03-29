import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/assets/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: { status: true, repairs: true, deviceTemplate: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json(asset);
  } catch (error) {
    console.error("GET /api/assets/[id]", error);
    return NextResponse.json(
      { error: "Failed to fetch asset" },
      { status: 500 }
    );
  }
}

// PUT /api/assets/:id - Update asset status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const { id } = await params;
    const before = await prisma.asset.findUnique({
      where: { id },
      include: { status: true },
    });
    if (!before) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      assetName,
      category,
      statusId,
      reason,
      serialNumber,
      manufacturer,
      model,
      deviceTemplateId,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (assetName != null) updateData.assetName = assetName;
    if (category != null) updateData.category = category;
    if (statusId != null) updateData.statusId = statusId;
    if (reason !== undefined) updateData.reason = reason;
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (model !== undefined) updateData.model = model;
    if (deviceTemplateId !== undefined) {
      if (deviceTemplateId === null) {
        updateData.deviceTemplateId = null;
      } else if (typeof deviceTemplateId === "string" && deviceTemplateId) {
        const tpl = await prisma.deviceTemplate.findUnique({
          where: { id: deviceTemplateId },
        });
        if (!tpl) {
          return NextResponse.json(
            { error: "deviceTemplateId not found" },
            { status: 400 }
          );
        }
        updateData.deviceTemplateId = deviceTemplateId;
      }
    }

    if (Object.keys(updateData).length === 0) {
      const unchanged = await prisma.asset.findUnique({
        where: { id },
        include: { status: true, deviceTemplate: true },
      });
      return NextResponse.json(unchanged);
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: { status: true, deviceTemplate: true },
    });

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (before.assetName !== asset.assetName) {
      changes.assetName = { from: before.assetName, to: asset.assetName };
    }
    if (before.category !== asset.category) {
      changes.category = { from: before.category, to: asset.category };
    }
    if (before.statusId !== asset.statusId) {
      changes.statusCode = {
        from: before.status.code,
        to: asset.status.code,
      };
    }
    if (before.reason !== asset.reason) {
      changes.reason = { from: before.reason, to: asset.reason };
    }
    if (before.serialNumber !== asset.serialNumber) {
      changes.serialNumber = {
        from: before.serialNumber,
        to: asset.serialNumber,
      };
    }
    if (before.manufacturer !== asset.manufacturer) {
      changes.manufacturer = {
        from: before.manufacturer,
        to: asset.manufacturer,
      };
    }
    if (before.model !== asset.model) {
      changes.model = { from: before.model, to: asset.model };
    }
    if (before.deviceTemplateId !== asset.deviceTemplateId) {
      changes.deviceTemplateId = {
        from: before.deviceTemplateId,
        to: asset.deviceTemplateId,
      };
    }

    const transitionToWrittenOff =
      before.status.code !== "written_off" && asset.status.code === "written_off";

    await createAuditLog({
      userId: user.id,
      actionType: transitionToWrittenOff ? "asset.write_off" : "asset.updated",
      notes: transitionToWrittenOff
        ? `Written off: ${asset.assetName}${asset.reason ? ` — ${asset.reason}` : ""}`
        : `Updated: ${asset.assetName}`,
      metadata: {
        assetId: id,
        changes,
        ...(transitionToWrittenOff ? { writeOffReason: asset.reason } : {}),
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error("PUT /api/assets/[id]", error);
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 }
    );
  }
}
