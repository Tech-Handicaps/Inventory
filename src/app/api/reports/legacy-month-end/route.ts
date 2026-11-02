import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadLegacyMonthEndList } from "@/lib/reports/load-legacy-month-end";

/**
 * GET /api/reports/legacy-month-end
 * Prior-company quantity stock takes (Oct 2025–Mar 2026). Not the live register.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ months: await loadLegacyMonthEndList() });
  } catch (error) {
    console.error("GET /api/reports/legacy-month-end", error);
    return NextResponse.json(
      { error: "Failed to load prior month-end stock" },
      { status: 500 }
    );
  }
}
