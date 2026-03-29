import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/repairs - List repairs
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("assetId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (assetId) where.assetId = assetId;
    if (status) where.repairStatus = status;

    const repairs = await prisma.repair.findMany({
      where,
      include: { asset: { include: { status: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(repairs);
  } catch (error) {
    console.error("GET /api/repairs", error);
    return NextResponse.json(
      { error: "Failed to fetch repairs" },
      { status: 500 }
    );
  }
}

// POST /api/repairs - Create repair
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { assetId, repairStatus, technicianNotes } = body;

    if (!assetId) {
      return NextResponse.json(
        { error: "assetId is required" },
        { status: 400 }
      );
    }

    const repair = await prisma.repair.create({
      data: {
        assetId,
        repairStatus: repairStatus ?? "pending",
        technicianNotes,
      },
      include: { asset: { include: { status: true } } },
    });

    return NextResponse.json(repair);
  } catch (error) {
    console.error("POST /api/repairs", error);
    return NextResponse.json(
      { error: "Failed to create repair" },
      { status: 500 }
    );
  }
}
