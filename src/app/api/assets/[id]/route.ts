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
      dataSource,
      zohoAssistDeviceId,
      zohoAssistOrgId,
      zohoAssistDepartmentId,
      deviceLocation,
      processorName,
      systemRam,
      systemGpu,
      lastSyncedFromAssistAt,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (assetName != null) updateData.assetName = assetName;
    if (category != null) updateData.category = category;
    if (statusId != null) updateData.statusId = statusId;
    if (reason !== undefined) updateData.reason = reason;
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (model !== undefined) updateData.model = model;
    if (dataSource !== undefined) {
      if (dataSource === "manual" || dataSource === "zoho_assist") {
        updateData.dataSource = dataSource;
      }
    }
    if (zohoAssistDeviceId !== undefined) {
      updateData.zohoAssistDeviceId =
        zohoAssistDeviceId === null || zohoAssistDeviceId === ""
          ? null
          : typeof zohoAssistDeviceId === "string"
            ? zohoAssistDeviceId.trim() || null
            : undefined;
    }
    if (zohoAssistOrgId !== undefined) {
      updateData.zohoAssistOrgId =
        zohoAssistOrgId === null || zohoAssistOrgId === ""
          ? null
          : typeof zohoAssistOrgId === "string"
            ? zohoAssistOrgId.trim() || null
            : undefined;
    }
    if (zohoAssistDepartmentId !== undefined) {
      updateData.zohoAssistDepartmentId =
        zohoAssistDepartmentId === null || zohoAssistDepartmentId === ""
          ? null
          : typeof zohoAssistDepartmentId === "string"
            ? zohoAssistDepartmentId.trim() || null
            : undefined;
    }
    if (deviceLocation !== undefined) {
      updateData.deviceLocation =
        deviceLocation === null || deviceLocation === ""
          ? null
          : typeof deviceLocation === "string"
            ? deviceLocation.trim() || null
            : undefined;
    }
    if (processorName !== undefined) {
      updateData.processorName =
        processorName === null || processorName === ""
          ? null
          : typeof processorName === "string"
            ? processorName.trim() || null
            : undefined;
    }
    if (systemRam !== undefined) {
      updateData.systemRam =
        systemRam === null || systemRam === ""
          ? null
          : typeof systemRam === "string"
            ? systemRam.trim() || null
            : undefined;
    }
    if (systemGpu !== undefined) {
      updateData.systemGpu =
        systemGpu === null || systemGpu === ""
          ? null
          : typeof systemGpu === "string"
            ? systemGpu.trim() || null
            : undefined;
    }
    if (lastSyncedFromAssistAt !== undefined) {
      if (lastSyncedFromAssistAt === null) {
        updateData.lastSyncedFromAssistAt = null;
      } else if (typeof lastSyncedFromAssistAt === "string" && lastSyncedFromAssistAt.trim()) {
        updateData.lastSyncedFromAssistAt = new Date(lastSyncedFromAssistAt.trim());
      }
    }
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
    if (before.dataSource !== asset.dataSource) {
      changes.dataSource = { from: before.dataSource, to: asset.dataSource };
    }
    if (before.zohoAssistDeviceId !== asset.zohoAssistDeviceId) {
      changes.zohoAssistDeviceId = {
        from: before.zohoAssistDeviceId,
        to: asset.zohoAssistDeviceId,
      };
    }
    if (before.deviceLocation !== asset.deviceLocation) {
      changes.deviceLocation = {
        from: before.deviceLocation,
        to: asset.deviceLocation,
      };
    }
    if (before.processorName !== asset.processorName) {
      changes.processorName = {
        from: before.processorName,
        to: asset.processorName,
      };
    }
    if (before.systemRam !== asset.systemRam) {
      changes.systemRam = { from: before.systemRam, to: asset.systemRam };
    }
    if (before.systemGpu !== asset.systemGpu) {
      changes.systemGpu = { from: before.systemGpu, to: asset.systemGpu };
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
