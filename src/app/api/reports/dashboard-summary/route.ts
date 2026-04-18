import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

/** Aggregated slices for dashboard visuals (category, source, recent activity). */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const [totalAssets, byCategory, byDataSource, recentAssets] =
      await Promise.all([
        prisma.asset.count(),
        prisma.asset.groupBy({
          by: ["category"],
          _count: { id: true },
        }),
        prisma.asset.groupBy({
          by: ["dataSource"],
          _count: { id: true },
        }),
        prisma.asset.findMany({
          take: 10,
          orderBy: { dateUpdated: "desc" },
          select: {
            id: true,
            assetName: true,
            category: true,
            dateUpdated: true,
            dataSource: true,
            status: { select: { label: true, code: true } },
          },
        }),
      ]);

    const categories = byCategory
      .map((c) => ({
        category: c.category,
        count: c._count.id,
      }))
      .sort((a, b) => b.count - a.count);

    const sources = byDataSource.map((d) => ({
      dataSource: d.dataSource,
      count: d._count.id,
    }));

    return NextResponse.json({
      totalAssets,
      byCategory: categories,
      byDataSource: sources,
      recentAssets,
    });
  } catch (error) {
    console.error("GET /api/reports/dashboard-summary", error);
    return NextResponse.json(
      { error: "Failed to load dashboard summary" },
      { status: 500 }
    );
  }
}
