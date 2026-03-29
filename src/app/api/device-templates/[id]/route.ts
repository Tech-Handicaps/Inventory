import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
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

    const updated = await prisma.deviceTemplate.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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
  try {
    const { id } = await params;
    await prisma.deviceTemplate.delete({ where: { id } });
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
