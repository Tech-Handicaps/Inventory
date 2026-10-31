import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { catchToJsonError, jsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { optionalIsoDateFromBody } from "@/lib/dates/optional-iso-date";
import {
  assetTagsForDisplay,
  parseTagsFromUnknown,
  resolveTagsForSave,
} from "@/lib/inventory/asset-tags";
import { listAssetsSimple } from "@/lib/inventory/asset-query";
import { findAssetBySerial } from "@/lib/inventory/serial-lookup";
import { nextResponseIfPrismaSchemaDrift } from "@/lib/prisma-error-response";
import { prisma } from "@/lib/prisma";

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const createAssetSchema = z.object({
  assetName: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  statusId: z.string().trim().min(1).optional(),
  reason: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  deviceTemplateId: optionalTrimmed,
  clubId: optionalTrimmed,
  dataSource: z.enum(["manual", "zoho_assist"]).optional(),
  zohoAssistDeviceId: optionalTrimmed,
  zohoAssistOrgId: optionalTrimmed,
  zohoAssistDepartmentId: optionalTrimmed,
  deviceLocation: optionalTrimmed,
  processorName: optionalTrimmed,
  systemRam: optionalTrimmed,
  systemGpu: optionalTrimmed,
  lastSyncedFromAssistAt: optionalTrimmed,
  purchaseDate: z.string().nullable().optional(),
  warrantyEndDate: z.string().nullable().optional(),
});

// GET /api/assets - List assets with filters
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const statusCode = searchParams.get("statusCode");
    const category = searchParams.get("category");
    const clubId = searchParams.get("clubId")?.trim();
    const limit = Math.min(
      1000,
      Math.max(1, parseInt(searchParams.get("limit") ?? "500", 10) || 500)
    );
    const offset = Math.max(
      0,
      parseInt(searchParams.get("offset") ?? "0", 10) || 0
    );

    const where: Prisma.AssetWhereInput = {};
    if (status) where.statusId = status;
    if (category) where.category = category;
    if (clubId) where.clubId = clubId;
    if (statusCode && !status) where.status = { code: statusCode };

    const { assets, total } = await listAssetsSimple({ where, limit, offset });
    return NextResponse.json({ assets, total });
  } catch (error) {
    console.error("GET /api/assets", error);
    const drift = nextResponseIfPrismaSchemaDrift(error);
    if (drift) return drift;
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
  const { user } = auth;
  try {
    const parsed = await parseJsonBody(request, createAssetSchema);
    if (isNextResponse(parsed)) return parsed;

    const {
      assetName,
      category,
      tags: tagsInput,
      statusId,
      reason,
      serialNumber,
      manufacturer,
      model,
      deviceTemplateId,
      clubId,
      dataSource,
      zohoAssistDeviceId,
      zohoAssistOrgId,
      zohoAssistDepartmentId,
      deviceLocation,
      processorName,
      systemRam,
      systemGpu,
      lastSyncedFromAssistAt,
      purchaseDate,
      warrantyEndDate,
    } = parsed;

    let resolvedName =
      typeof assetName === "string" ? assetName.trim() : "";
    let tagResolution = resolveTagsForSave({
      tags: parseTagsFromUnknown(tagsInput),
      category: typeof category === "string" ? category : undefined,
    });
    let resolvedManufacturer =
      typeof manufacturer === "string" && manufacturer.trim()
        ? manufacturer.trim()
        : undefined;
    let resolvedModel =
      typeof model === "string" && model.trim() ? model.trim() : undefined;
    const templateId = deviceTemplateId;

    const resolvedClubId = clubId;
    if (resolvedClubId) {
      const clubRow = await prisma.club.findUnique({
        where: { id: resolvedClubId },
      });
      if (!clubRow) {
        return jsonError("clubId not found", 400);
      }
    }

    if (templateId) {
      const tpl = await prisma.deviceTemplate.findUnique({
        where: { id: templateId },
      });
      if (!tpl) {
        return jsonError("deviceTemplateId not found", 400);
      }
      if (!tagResolution.category) {
        tagResolution = resolveTagsForSave({
          tags: assetTagsForDisplay(tpl.tags, tpl.category),
        });
      }
      if (!resolvedManufacturer) resolvedManufacturer = tpl.manufacturer;
      if (!resolvedModel) resolvedModel = tpl.model;
      if (!resolvedName) resolvedName = tpl.label;
    }

    if (!resolvedName || !tagResolution.category || !statusId) {
      return jsonError(
        "assetName (or a device template), at least one asset tag, and statusId are required",
        400
      );
    }

    const resolvedCategory = tagResolution.category;
    const resolvedTags = tagResolution.tags;

    const resolvedDataSource = dataSource ?? "manual";

    const resolvedAssistId = zohoAssistDeviceId;

    if (typeof serialNumber === "string" && serialNumber.trim()) {
      const existing = await findAssetBySerial(serialNumber);
      if (existing) {
        return NextResponse.json(
          {
            error: `That serial number is already on the board (${existing.assetName}, ${existing.status.label}).`,
            code: "UNIQUE_VIOLATION",
          },
          { status: 409 }
        );
      }
    }

    const purchaseD = optionalIsoDateFromBody(purchaseDate);
    const warrantyD = optionalIsoDateFromBody(warrantyEndDate);

    const asset = await prisma.asset.create({
      data: {
        assetName: resolvedName,
        category: resolvedCategory,
        tags: resolvedTags,
        statusId,
        reason,
        deviceTemplateId: templateId,
        clubId: resolvedClubId,
        serialNumber:
          typeof serialNumber === "string" && serialNumber.trim()
            ? serialNumber.trim()
            : undefined,
        manufacturer: resolvedManufacturer,
        model: resolvedModel,
        dataSource: resolvedDataSource,
        zohoAssistDeviceId: resolvedAssistId,
        zohoAssistOrgId,
        zohoAssistDepartmentId,
        deviceLocation,
        processorName,
        systemRam,
        systemGpu,
        lastSyncedFromAssistAt:
          lastSyncedFromAssistAt
            ? new Date(lastSyncedFromAssistAt)
            : undefined,
        ...(purchaseD !== undefined ? { purchaseDate: purchaseD } : {}),
        ...(warrantyD !== undefined ? { warrantyEndDate: warrantyD } : {}),
      },
      include: { status: true, deviceTemplate: true, club: true },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "asset.created",
      notes: asset.assetName,
      metadata: {
        assetId: asset.id,
        statusCode: asset.status.code,
        category: asset.category,
        serialNumber: asset.serialNumber,
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    const drift = nextResponseIfPrismaSchemaDrift(error);
    if (drift) return drift;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const fields = error.meta?.target;
      const target =
        Array.isArray(fields) && fields.includes("serialNumber")
          ? "serialNumber"
          : Array.isArray(fields) && fields.includes("zohoAssistDeviceId")
            ? "zohoAssistDeviceId"
            : "unique field";
      return NextResponse.json(
        {
          error:
            target === "serialNumber"
              ? "That serial number is already on the board."
              : target === "zohoAssistDeviceId"
                ? "That Zoho Assist device is already linked to an asset."
                : "This record conflicts with an existing entry.",
          code: "UNIQUE_VIOLATION",
        },
        { status: 409 }
      );
    }
    console.error("POST /api/assets", error);
    return catchToJsonError("POST /api/assets", error, "Failed to create asset");
  }
}
