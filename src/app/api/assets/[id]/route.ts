import { NextRequest, NextResponse } from "next/server";
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
  try {
    const { id } = await params;
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

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: { status: true, deviceTemplate: true },
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
