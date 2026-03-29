import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/reports/writeoffs - Write-off summary with reasoning
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const writtenOffStatus = await prisma.assetStatus.findFirst({
      where: { code: "written_off" },
    });

    if (!writtenOffStatus) {
      return NextResponse.json({ assets: [], total: 0, byReason: [] });
    }

    const assets = await prisma.asset.findMany({
      where: { statusId: writtenOffStatus.id },
      include: { status: true },
      orderBy: { dateUpdated: "desc" },
    });

    const byReason = assets.reduce<Record<string, number>>((acc, a) => {
      const r = a.reason || "Unspecified";
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {});

    const byReasonArray = Object.entries(byReason).map(([reason, count]) => ({
      reason,
      count,
    }));

    return NextResponse.json({
      assets,
      total: assets.length,
      byReason: byReasonArray,
    });
  } catch (error) {
    console.error("GET /api/reports/writeoffs", error);
    return NextResponse.json(
      { error: "Failed to generate write-offs report" },
      { status: 500 }
    );
  }
}
