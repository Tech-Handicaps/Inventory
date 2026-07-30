import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  buildStockReconcileReport,
  stockStatusInclude,
} from "@/lib/reports/stock-reconcile";

/**
 * GET /api/reports/reconcile
 * JSON stock reconcile for finance — point-in-time snapshot grouped by asset type.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const assets = await prisma.asset.findMany({
      include: stockStatusInclude,
      orderBy: [{ category: "asc" }, { assetName: "asc" }],
    });

    const report = buildStockReconcileReport(assets);
    const generatedAt = new Date().toISOString();

    return NextResponse.json({
      generatedAt,
      ...report,
    });
  } catch (error) {
    console.error("GET /api/reports/reconcile", error);
    return NextResponse.json(
      { error: "Failed to build reconcile report" },
      { status: 500 }
    );
  }
}
