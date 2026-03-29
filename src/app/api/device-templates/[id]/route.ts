import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const { id } = await params;
    const before = await prisma.deviceTemplate.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { label, manufacturer, model, category, notes } = body;

    const data: Record<string, unknown> = {};
    if (typeof label === "string" && label.trim()) data.label = label.trim();
    if (typeof manufacturer === "string" && manufacturer.trim())
      data.manufacturer = manufacturer.trim();
    if (typeof model === "string" && model.trim()) data.model = model.trim();
    if (typeof category === "string" && category.trim())
      data.category = category.trim();
    if (notes === null || notes === "") data.notes = null;
    else if (typeof notes === "string" && notes.trim())
      data.notes = notes.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json(before);
    }

    const updated = await prisma.deviceTemplate.update({
      where: { id },
      data,
    });

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (before.label !== updated.label) {
      changes.label = { from: before.label, to: updated.label };
    }
    if (before.manufacturer !== updated.manufacturer) {
      changes.manufacturer = {
        from: before.manufacturer,
        to: updated.manufacturer,
      };
    }
    if (before.model !== updated.model) {
      changes.model = { from: before.model, to: updated.model };
    }
    if (before.category !== updated.category) {
      changes.category = { from: before.category, to: updated.category };
    }
    if (before.notes !== updated.notes) {
      changes.notes = { from: before.notes, to: updated.notes };
    }

    await createAuditLog({
      userId: user.id,
      actionType: "device_template.updated",
      notes: updated.label,
      metadata: { templateId: id, changes },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A template with this manufacturer and model already exists" },
        { status: 409 }
      );
    }
    console.error("PUT /api/device-templates/[id]", error);
    return NextResponse.json(
      { error: "Failed to update device template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const { id } = await params;
    const existing = await prisma.deviceTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.deviceTemplate.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      actionType: "device_template.deleted",
      notes: existing.label,
      metadata: {
        templateId: id,
        manufacturer: existing.manufacturer,
        model: existing.model,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("DELETE /api/device-templates/[id]", error);
    return NextResponse.json(
      { error: "Failed to delete device template" },
      { status: 500 }
    );
  }
}
