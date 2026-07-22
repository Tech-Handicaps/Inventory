import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prismaGeoFieldsFromPublicIp } from "@/lib/geo/lookup-ip";
import {
  mapAssistDeviceJsonToHardwareFields,
  mergeAssistListComputerIntoMapped,
} from "@/lib/zoho/assist-device-map";
import {
  fetchAssistDeviceDetails,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
} from "@/lib/zoho/client";
import { resolveAssistResourceId } from "@/lib/zoho/resolve-assist-resource";
import { prisma } from "@/lib/prisma";

type ImportBody = {
  resourceId?: string;
  displayName?: string;
  acceptWithoutTemplate?: boolean;
  createTemplate?: boolean;
  templateCategory?: string;
  clubId?: string;
};

async function findMatchingTemplate(
  manufacturer: string | null | undefined,
  model: string | null | undefined
) {
  const m = manufacturer?.trim();
  const o = model?.trim();
  if (!m || !o) return null;
  return prisma.deviceTemplate.findFirst({
    where: {
      manufacturer: { equals: m, mode: "insensitive" },
      model: { equals: o, mode: "insensitive" },
    },
  });
}

// POST /api/assets/import-assist — import one asset from Zoho Assist by resource id or display name
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const body = (await request.json()) as ImportBody;
    const {
      resourceId: ridIn,
      displayName: dnIn,
      acceptWithoutTemplate,
      createTemplate,
      templateCategory,
      clubId: clubIdIn,
    } = body;

    const resolvedImportClubId =
      typeof clubIdIn === "string" && clubIdIn.trim() ? clubIdIn.trim() : undefined;
    if (resolvedImportClubId) {
      const clubRow = await prisma.club.findUnique({
        where: { id: resolvedImportClubId },
      });
      if (!clubRow) {
        return NextResponse.json({ error: "clubId not found" }, { status: 400 });
      }
    }

    const c = await loadZohoAssistSettings();
    if (!c.clientId || !c.clientSecret || !c.refreshToken) {
      return NextResponse.json(
        { error: "Zoho Assist is not configured (save OAuth credentials first)." },
        { status: 400 }
      );
    }
    const departmentId = c.defaultDepartmentId?.trim() || "";
    if (!departmentId) {
      return NextResponse.json(
        {
          error:
            "Set Default department id in Settings → Zoho Assist (required for Assist device APIs).",
        },
        { status: 400 }
      );
    }

    const { access_token } = await refreshZohoAccessToken(c);
    const orgId = c.defaultOrgId;

    const resolved = await resolveAssistResourceId(access_token, departmentId, orgId, {
      resourceId: ridIn,
      displayName: dnIn,
    });
    const { resourceId, listComputer } = resolved;

    const raw = await fetchAssistDeviceDetails(access_token, resourceId, {
      departmentId,
      orgId,
    });
    let mapped = mapAssistDeviceJsonToHardwareFields(raw);
    mapped = mergeAssistListComputerIntoMapped(listComputer, mapped);

    const assistId = mapped.zohoAssistDeviceId ?? resourceId;
    // Only check existence by id — do not pull Assist-only merge fields here. Purchase/warranty stay null until set in the app (never from Assist).
    const existing = await prisma.asset.findFirst({
      where: { zohoAssistDeviceId: assistId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          code: "DEVICE_ALREADY_IMPORTED",
          error: "This Assist device is already on the board.",
          assetId: existing.id,
        },
        { status: 409 }
      );
    }

    let template = await findMatchingTemplate(mapped.manufacturer, mapped.model);

    if (!template && createTemplate) {
      const category = (templateCategory ?? "Hardware").trim() || "Hardware";
      const manufacturer =
        mapped.manufacturer?.trim() || "Unknown manufacturer";
      const model =
        mapped.model?.trim() ||
        (assistId.length > 6 ? assistId.slice(-12) : assistId) ||
        "Unknown";
      const label =
        mapped.assetName?.trim() || `${manufacturer} ${model}`.trim();
      try {
        template = await prisma.deviceTemplate.create({
          data: {
            label,
            manufacturer,
            model,
            category,
            processorName: mapped.processorName ?? undefined,
            systemRam: mapped.systemRam ?? undefined,
            systemGpu: mapped.systemGpu ?? undefined,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          template = await findMatchingTemplate(manufacturer, model);
        } else {
          throw e;
        }
      }
      if (createTemplate && !template) {
        return NextResponse.json(
          {
            error:
              "Could not create or resolve a device template (duplicate manufacturer/model?).",
          },
          { status: 500 }
        );
      }
    }

    if (!template && !acceptWithoutTemplate && !createTemplate) {
      const mfg = mapped.manufacturer?.trim() ?? "";
      const mdl = mapped.model?.trim() ?? "";
      return NextResponse.json(
        {
          code: "NO_MATCHING_DEVICE_TEMPLATE",
          error:
            "No device template matches this manufacturer/model. Create a template in Settings, import without a template, or create one from this device.",
          resourceId: assistId,
          mapped: {
            assetName: mapped.assetName,
            manufacturer: mfg || null,
            model: mdl || null,
            serialNumber: mapped.serialNumber ?? null,
            deviceLocation: mapped.deviceLocation ?? null,
            processorName: mapped.processorName ?? null,
            systemRam: mapped.systemRam ?? null,
            systemGpu: mapped.systemGpu ?? null,
          },
          suggestedTemplate: {
            label:
              mapped.assetName?.trim() ||
              [mfg, mdl].filter(Boolean).join(" ") ||
              "Imported device",
            manufacturer: mfg || "Unknown manufacturer",
            model: mdl || assistId.slice(-12),
            category: "Hardware",
          },
        },
        { status: 409 }
      );
    }

    // Remote Assist devices are typically already at a customer site — prefer Deployed when seeded
    let initialStatus =
      (await prisma.assetStatus.findFirst({ where: { code: "deployed" } })) ??
      (await prisma.assetStatus.findFirst({ where: { code: "new_stock" } }));
    if (!initialStatus) {
      initialStatus = await prisma.assetStatus.findFirst({
        orderBy: { sortOrder: "asc" },
      });
    }
    if (!initialStatus) {
      return NextResponse.json(
        {
          error:
            "No asset lifecycle statuses found. From the project folder run: npm run db:seed",
        },
        { status: 500 }
      );
    }

    const category = template?.category ?? "Hardware";
    const assetName =
      mapped.assetName?.trim() ||
      dnIn?.trim() ||
      assistId;

    const ip = mapped.publicIp?.trim() || null;
    const geo = await prismaGeoFieldsFromPublicIp(ip);

    const serialForCreate = mapped.serialNumber?.trim() || null;
    if (serialForCreate) {
      const serialConflict = await prisma.asset.findFirst({
        where: { serialNumber: serialForCreate },
        select: {
          id: true,
          assetName: true,
          zohoAssistDeviceId: true,
        },
      });
      if (serialConflict) {
        return NextResponse.json(
          {
            code: "DUPLICATE_SERIAL",
            error: `Serial number "${serialForCreate}" is already registered to "${serialConflict.assetName}".`,
            assetId: serialConflict.id,
            serialNumber: serialForCreate,
            existingAssistLinked: Boolean(serialConflict.zohoAssistDeviceId),
          },
          { status: 409 }
        );
      }
    }

    // Assist-sourced fields only — purchaseDate / warrantyEndDate are never set here (Postgres-only; edit asset after import).
    let asset;
    try {
      asset = await prisma.asset.create({
      data: {
        assetName,
        category,
        statusId: initialStatus.id,
        dataSource: "zoho_assist",
        zohoAssistDeviceId: assistId,
        zohoAssistOrgId: orgId ?? undefined,
        zohoAssistDepartmentId: departmentId,
        deviceTemplateId: template?.id,
        clubId: resolvedImportClubId,
        deviceLocation: mapped.deviceLocation ?? undefined,
        serialNumber: serialForCreate ?? undefined,
        manufacturer: mapped.manufacturer ?? template?.manufacturer ?? undefined,
        model: mapped.model ?? template?.model ?? undefined,
        processorName: mapped.processorName ?? template?.processorName ?? undefined,
        systemRam: mapped.systemRam ?? template?.systemRam ?? undefined,
        systemGpu: mapped.systemGpu ?? template?.systemGpu ?? undefined,
        lastSyncedFromAssistAt: new Date(),
        publicIp: ip ?? undefined,
        publicIpAssistSyncedAt: ip ? new Date() : undefined,
        ...geo,
      },
      include: { status: true, deviceTemplate: true, club: true },
    });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const targets = Array.isArray(e.meta?.target)
          ? (e.meta.target as string[])
          : [];
        if (targets.includes("zohoAssistDeviceId")) {
          const conflict = await prisma.asset.findFirst({
            where: { zohoAssistDeviceId: assistId },
            select: { id: true },
          });
          return NextResponse.json(
            {
              code: "DEVICE_ALREADY_IMPORTED",
              error: "This Assist device is already on the board.",
              assetId: conflict?.id,
            },
            { status: 409 }
          );
        }
        if (targets.includes("serialNumber")) {
          const sn = serialForCreate ?? mapped.serialNumber?.trim();
          const conflict = sn
            ? await prisma.asset.findFirst({
                where: { serialNumber: sn },
                select: { id: true, assetName: true, zohoAssistDeviceId: true },
              })
            : null;
          return NextResponse.json(
            {
              code: "DUPLICATE_SERIAL",
              error: sn
                ? `Serial number "${sn}" is already registered${conflict ? ` to "${conflict.assetName}"` : ""}.`
                : "An asset with this serial number already exists.",
              assetId: conflict?.id,
              serialNumber: sn,
              existingAssistLinked: Boolean(conflict?.zohoAssistDeviceId),
            },
            { status: 409 }
          );
        }
      }
      throw e;
    }

    await createAuditLog({
      userId: user.id,
      actionType: "asset.imported_from_zoho_assist",
      notes: asset.assetName,
      metadata: {
        assetId: asset.id,
        zohoAssistDeviceId: assistId,
        deviceTemplateId: asset.deviceTemplateId,
      },
    });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("POST /api/assets/import-assist", error);
    const { catchToJsonError } = await import("@/lib/api/error-response");
    return catchToJsonError(
      "POST /api/assets/import-assist",
      error,
      "Import failed"
    );
  }
}
