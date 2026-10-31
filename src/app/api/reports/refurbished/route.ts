import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { REPORT_ASSET_LIST_LIMIT } from "@/lib/reports/limits";

// GET /api/reports/refurbished - Redistribution readiness
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const where = { status: { code: "refurbished" } };
    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        include: { status: true },
        orderBy: { dateUpdated: "desc" },
        take: REPORT_ASSET_LIST_LIMIT,
      }),
    ]);

    return NextResponse.json({
      assets,
      total,
      truncated: total > assets.length,
    });
  } catch (error) {
    console.error("GET /api/reports/refurbished", error);
    return NextResponse.json(
      { error: "Failed to generate refurbished report" },
      { status: 500 }
    );
  }
}
