import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  extractAssistListRows,
  findAssistComputerRowBySearch,
  mapAssistDeviceJsonToHardwareFields,
  mergeAssistListComputerIntoMapped,
} from "@/lib/zoho/assist-device-map";
import {
  fetchAssistDeviceDetails,
  fetchAssistDevicesList,
  loadZohoAssistSettings,
  refreshZohoAccessToken,
  ZOHO_ASSIST_DEVICES_MAX_COUNT,
} from "@/lib/zoho/client";
import { prisma } from "@/lib/prisma";

type ImportBody = {
  resourceId?: string;
  displayName?: string;
  acceptWithoutTemplate?: boolean;
  createTemplate?: boolean;
  templateCategory?: string;
};

async function resolveResourceId(
  accessToken: string,
  departmentId: string,
  orgId: string | null | undefined,
  input: { resourceId?: string; displayName?: string }
): Promise<{ resourceId: string; listComputer?: unknown }> {
  if (input.resourceId?.trim()) {
    return { resourceId: input.resourceId.trim() };
  }
  const dn = input.displayName?.trim();
  if (!dn) {
    throw new Error("Provide resourceId or displayName (device display name in Assist).");
  }

  let listJson = await fetchAssistDevicesList(accessToken, {
    departmentId,
    orgId,
    displayName: dn,
    count: ZOHO_ASSIST_DEVICES_MAX_COUNT,
    index: 1,
  });
  let found = findAssistComputerRowBySearch(listJson, dn);
  if (!found) {
    for (let page = 1; page <= 100; page++) {
      listJson = await fetchAssistDevicesList(accessToken, {
        departmentId,
        orgId,
        count: ZOHO_ASSIST_DEVICES_MAX_COUNT,
        index: page,
      });
      found = findAssistComputerRowBySearch(listJson, dn);
      if (found) break;
      const pageRows = extractAssistListRows(listJson);
      if (pageRows.length < ZOHO_ASSIST_DEVICES_MAX_COUNT) break;
    }
  }
  if (!found) {
    throw new Error(
      `No unattended device matched “${dn}”. Confirm the name in Zoho Assist and your default department ID.`
    );
  }
  return { resourceId: found.resourceId, listComputer: found.raw };
}

async function findMatchingTemplate(manufacturer: string | null | undefined, model: string | null | undefined) {
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
    } = body;

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

    const resolved = await resolveResourceId(access_token, departmentId, orgId, {
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
    const existing = await prisma.asset.findFirst({
      where: { zohoAssistDeviceId: assistId },
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

    const asset = await prisma.asset.create({
      data: {
        assetName,
        category,
        statusId: initialStatus.id,
        dataSource: "zoho_assist",
        zohoAssistDeviceId: assistId,
        zohoAssistOrgId: orgId ?? undefined,
        zohoAssistDepartmentId: departmentId,
        deviceTemplateId: template?.id,
        deviceLocation: mapped.deviceLocation ?? undefined,
        serialNumber: mapped.serialNumber ?? undefined,
        manufacturer: mapped.manufacturer ?? template?.manufacturer ?? undefined,
        model: mapped.model ?? template?.model ?? undefined,
        processorName: mapped.processorName ?? template?.processorName ?? undefined,
        systemRam: mapped.systemRam ?? template?.systemRam ?? undefined,
        systemGpu: mapped.systemGpu ?? template?.systemGpu ?? undefined,
        lastSyncedFromAssistAt: new Date(),
      },
      include: { status: true, deviceTemplate: true },
    });

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
    const message = error instanceof Error ? error.message : "Import failed";
    console.error("POST /api/assets/import-assist", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
