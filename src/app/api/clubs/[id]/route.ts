import { Prisma } from "@prisma/client";
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
    const before = await prisma.club.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name } = body as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const updated = await prisma.club.update({
      where: { id },
      data: { name: name.trim() },
    });

    await createAuditLog({
      userId: user.id,
      actionType: "club.updated",
      notes: updated.name,
      metadata: {
        clubId: id,
        changes:
          before.name !== updated.name
            ? { name: { from: before.name, to: updated.name } }
            : {},
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A club with this name already exists" },
        { status: 409 }
      );
    }
    console.error("PUT /api/clubs/[id]", error);
    return NextResponse.json(
      { error: "Failed to update club" },
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
    const existing = await prisma.club.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.club.delete({ where: { id } });

    await createAuditLog({
      userId: user.id,
      actionType: "club.deleted",
      notes: existing.name,
      metadata: { clubId: id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/clubs/[id]", error);
    return NextResponse.json(
      { error: "Failed to delete club" },
      { status: 500 }
    );
  }
}
