import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/statuses - List asset lifecycle states (extensible)
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const statuses = await prisma.assetStatus.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(statuses);
  } catch (error) {
    console.error("GET /api/statuses", error);
    return NextResponse.json(
      { error: "Failed to fetch statuses" },
      { status: 500 }
    );
  }
}
