import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prismaMutationError } from "@/lib/prisma/error-response";
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
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      label,
      manufacturer,
      model,
      category,
      notes,
      processorName,
      systemRam,
      systemGpu,
    } = body as Record<string, unknown>;

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
        processorName:
          typeof processorName === "string" && processorName.trim()
            ? processorName.trim()
            : undefined,
        systemRam:
          typeof systemRam === "string" && systemRam.trim()
            ? systemRam.trim()
            : undefined,
        systemGpu:
          typeof systemGpu === "string" && systemGpu.trim()
            ? systemGpu.trim()
            : undefined,
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: "A template with this manufacturer and model already exists",
          prismaCode: error.code,
        },
        { status: 409 }
      );
    }
    const { status, body } = prismaMutationError(
      error,
      "Failed to create device template"
    );
    console.error("POST /api/device-templates", error);
    return NextResponse.json(body, { status });
  }
}
