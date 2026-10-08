import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reports/finance-packs
 * Official finance months that were sent and kept. Manual tests are not listed.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const packs = await prisma.financeMonthPack.findMany({
      orderBy: { monthKey: "desc" },
      include: { _count: { select: { lines: true } } },
    });
    return NextResponse.json(
      {
        months: packs.map((pack) => ({
          monthKey: pack.monthKey,
          monthLabel: pack.monthLabel,
          monthEndingLabel: pack.monthEndingLabel,
          sentAt: pack.sentAt.toISOString(),
          recipientCount: pack.recipientCount,
          newStock: pack.newStock,
          refurbished: pack.refurbished,
          usable: pack.usable,
          deployed: pack.deployed,
          assessment: pack.assessment,
          inRepair: pack.inRepair,
          writtenOff: pack.writtenOff,
          register: pack.register,
          modelCount: pack._count.lines,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/reports/finance-packs", error);
    return NextResponse.json(
      { error: "Failed to load official finance packs" },
      { status: 500 }
    );
  }
}
