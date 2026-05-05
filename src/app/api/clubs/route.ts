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
    const clubs = await prisma.club.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(clubs);
  } catch (error) {
    console.error("GET /api/clubs", error);
    return NextResponse.json(
      { error: "Failed to fetch clubs" },
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

    const { name } = body as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const created = await prisma.club.create({
      data: { name: name.trim() },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "club.created",
      notes: created.name,
      metadata: { clubId: created.id },
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A club with this name already exists", prismaCode: error.code },
        { status: 409 }
      );
    }
    const { status, body } = prismaMutationError(error, "Failed to create club");
    console.error("POST /api/clubs", error);
    return NextResponse.json(body, { status });
  }
}
