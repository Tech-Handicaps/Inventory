import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/reports/repairs - Repairs pipeline report
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const [byStatus, repairs] = await Promise.all([
      prisma.repair.groupBy({
        by: ["repairStatus"],
        _count: { id: true },
      }),
      prisma.repair.findMany({
        include: { asset: { include: { status: true } } },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
    ]);

    const pipeline = byStatus.map((s) => ({
      status: s.repairStatus,
      count: s._count.id,
    }));

    return NextResponse.json({ pipeline, repairs });
  } catch (error) {
    console.error("GET /api/reports/repairs", error);
    return NextResponse.json(
      { error: "Failed to generate repairs report" },
      { status: 500 }
    );
  }
}
