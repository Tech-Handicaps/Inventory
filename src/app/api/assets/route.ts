import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/assets - List assets with filters
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const statusCode = searchParams.get("statusCode");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") ?? "500", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const where: Record<string, unknown> = {};
    if (status) where.statusId = status;
    if (category) where.category = category;

    if (statusCode && !status) {
      const st = await prisma.assetStatus.findFirst({
        where: { code: statusCode },
      });
      if (st) where.statusId = st.id;
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: { status: true, deviceTemplate: true },
        orderBy: { dateUpdated: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({ assets, total });
  } catch (error) {
    console.error("GET /api/assets", error);
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 }
    );
  }
}

// POST /api/assets - Add new asset
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
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

    let resolvedName =
      typeof assetName === "string" ? assetName.trim() : "";
    let resolvedCategory =
      typeof category === "string" ? category.trim() : "";
    let resolvedManufacturer =
      typeof manufacturer === "string" && manufacturer.trim()
        ? manufacturer.trim()
        : undefined;
    let resolvedModel =
      typeof model === "string" && model.trim() ? model.trim() : undefined;
    const templateId: string | undefined =
      typeof deviceTemplateId === "string" && deviceTemplateId.trim()
        ? deviceTemplateId.trim()
        : undefined;

    if (templateId) {
      const tpl = await prisma.deviceTemplate.findUnique({
        where: { id: templateId },
      });
      if (!tpl) {
        return NextResponse.json(
          { error: "deviceTemplateId not found" },
          { status: 400 }
        );
      }
      if (!resolvedCategory) resolvedCategory = tpl.category;
      if (!resolvedManufacturer) resolvedManufacturer = tpl.manufacturer;
      if (!resolvedModel) resolvedModel = tpl.model;
      if (!resolvedName) resolvedName = tpl.label;
    }

    if (!resolvedName || !resolvedCategory || !statusId) {
      return NextResponse.json(
        {
          error:
            "assetName (or a device template), category, and statusId are required",
        },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.create({
      data: {
        assetName: resolvedName,
        category: resolvedCategory,
        statusId,
        reason,
        deviceTemplateId: templateId,
        serialNumber:
          typeof serialNumber === "string" && serialNumber.trim()
            ? serialNumber.trim()
            : undefined,
        manufacturer: resolvedManufacturer,
        model: resolvedModel,
      },
      include: { status: true, deviceTemplate: true },
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error("POST /api/assets", error);
    return NextResponse.json(
      { error: "Failed to create asset" },
      { status: 500 }
    );
  }
}
