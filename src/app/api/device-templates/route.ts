import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const templates = await prisma.deviceTemplate.findMany({
      orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/device-templates", error);
    return NextResponse.json(
      { error: "Failed to fetch device templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const body = await request.json();
    const { label, manufacturer, model, category, notes } = body;

    if (
      typeof label !== "string" ||
      !label.trim() ||
      typeof manufacturer !== "string" ||
      !manufacturer.trim() ||
      typeof model !== "string" ||
      !model.trim() ||
      typeof category !== "string" ||
      !category.trim()
    ) {
      return NextResponse.json(
        { error: "label, manufacturer, model, and category are required" },
        { status: 400 }
      );
    }

    const created = await prisma.deviceTemplate.create({
      data: {
        label: label.trim(),
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        category: category.trim(),
        notes:
          typeof notes === "string" && notes.trim() ? notes.trim() : undefined,
      },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "device_template.created",
      notes: created.label,
      metadata: {
        templateId: created.id,
        manufacturer: created.manufacturer,
        model: created.model,
        category: created.category,
      },
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    const msg =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (msg === "P2002") {
      return NextResponse.json(
        { error: "A template with this manufacturer and model already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/device-templates", error);
    return NextResponse.json(
      { error: "Failed to create device template" },
      { status: 500 }
    );
  }
}
