import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/reports/refurbished - Redistribution readiness
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const refurbishedStatus = await prisma.assetStatus.findFirst({
      where: { code: "refurbished" },
    });

    if (!refurbishedStatus) {
      return NextResponse.json({ assets: [], total: 0 });
    }

    const assets = await prisma.asset.findMany({
      where: { statusId: refurbishedStatus.id },
      include: { status: true },
      orderBy: { dateUpdated: "desc" },
    });

    return NextResponse.json({ assets, total: assets.length });
  } catch (error) {
    console.error("GET /api/reports/refurbished", error);
    return NextResponse.json(
      { error: "Failed to generate refurbished report" },
      { status: 500 }
    );
  }
}
