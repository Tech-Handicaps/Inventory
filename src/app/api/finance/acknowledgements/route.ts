import { NextRequest, NextResponse } from "next/server";
import { requireFinanceAckUser } from "@/lib/auth/require-finance-user";
import { nextResponseIfPrismaSchemaDrift } from "@/lib/prisma-error-response";
import { prisma } from "@/lib/prisma";

/** GET /api/finance/acknowledgements — list pending / all for finance. */
export async function GET(request: NextRequest) {
  const auth = await requireFinanceAckUser(request);
  if (auth instanceof NextResponse) return auth;

  const status = request.nextUrl.searchParams.get("status");

  try {
    const where =
      status === "pending"
        ? { status: "pending" }
        : status === "acknowledged"
          ? { status: "acknowledged" }
          : {};

    const items = await prisma.financeAcknowledgement.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            assetName: true,
            category: true,
            serialNumber: true,
            reason: true,
          },
        },
        repair: {
          select: { id: true, referenceNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ items });
  } catch (e) {
    const drift = nextResponseIfPrismaSchemaDrift(e);
    if (drift) return drift;
    console.error("GET /api/finance/acknowledgements", e);
    return NextResponse.json(
      { error: "Failed to load acknowledgements" },
      { status: 500 }
    );
  }
}
