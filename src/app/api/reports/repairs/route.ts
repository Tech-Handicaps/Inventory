import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/reports/repairs - Repairs pipeline report
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const byStatus = await prisma.repair.groupBy({
      by: ["repairStatus"],
      _count: { id: true },
    });

    const pipeline = byStatus.map((s) => ({
      status: s.repairStatus,
      count: s._count.id,
    }));

    const repairs = await prisma.repair.findMany({
      include: { asset: { include: { status: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ pipeline, repairs });
  } catch (error) {
    console.error("GET /api/reports/repairs", error);
    return NextResponse.json(
      { error: "Failed to generate repairs report" },
      { status: 500 }
    );
  }
}
