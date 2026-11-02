import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { loadReconciliation } from "@/lib/reports/load-reconciliation";

export const dynamic = "force-dynamic";

/** GET /api/reports/reconciliation — bridge from the prior count to the register. */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await loadReconciliation(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/reports/reconciliation", error);
    return NextResponse.json({ error: "Failed to load the reconciliation" }, { status: 500 });
  }
}
