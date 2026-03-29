import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/xero/health - Xero sync health monitor
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const byStatus = await prisma.xeroSync.groupBy({
      by: ["syncStatus", "xeroType"],
      _count: { id: true },
    });

    const summary = byStatus.reduce<
      Record<string, { fixed_asset: number; inventory: number }>
    >((acc, s) => {
      const key = s.syncStatus;
      if (!acc[key]) acc[key] = { fixed_asset: 0, inventory: 0 };
      acc[key][s.xeroType as "fixed_asset" | "inventory"] = s._count.id;
      return acc;
    }, {});

    const recent = await prisma.xeroSync.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { asset: true },
    });

    return NextResponse.json({
      configured: !!(
        process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET
      ),
      summary,
      recent,
    });
  } catch (error) {
    console.error("GET /api/xero/health", error);
    return NextResponse.json(
      { error: "Failed to fetch Xero health" },
      { status: 500 }
    );
  }
}
