import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/reports/stock - Stock on hand report
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const byStatus = await prisma.asset.groupBy({
      by: ["statusId"],
      _count: { id: true },
    });

    const statuses = await prisma.assetStatus.findMany({
      where: { id: { in: byStatus.map((s) => s.statusId) } },
    });
    const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));

    const stock = byStatus.map((s) => ({
      statusId: s.statusId,
      status: statusMap[s.statusId]?.label ?? "Unknown",
      count: s._count.id,
    }));

    const total = stock.reduce((acc, s) => acc + s.count, 0);

    return NextResponse.json({ stock, total });
  } catch (error) {
    console.error("GET /api/reports/stock", error);
    return NextResponse.json(
      { error: "Failed to generate stock report" },
      { status: 500 }
    );
  }
}
