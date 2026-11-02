import { NextRequest, NextResponse } from "next/server";
import { requireReportsAdmin } from "@/lib/auth/require-reports-admin";
import { runOfficialPack } from "@/lib/reports/send-monthly-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/reports/finance-packs/send  { action: "send_now" } | { action: "resend", monthKey }
 * Send now: store and email last month's pack if it is not stored yet.
 * Resend: email the stored files for a month again (never regenerated).
 */
export async function POST(request: NextRequest) {
  const auth = await requireReportsAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as { action?: string; monthKey?: string } | null;
  const action = body?.action;
  if (action !== "send_now" && action !== "resend") {
    return NextResponse.json({ error: "Action must be send_now or resend" }, { status: 400 });
  }
  if (action === "resend" && !/^\d{4}-\d{2}$/.test(body?.monthKey ?? "")) {
    return NextResponse.json({ error: "Resend needs the month (YYYY-MM)" }, { status: 400 });
  }

  const result = await runOfficialPack({
    mode: action,
    userId: auth.user.id,
    monthKey: action === "resend" ? body!.monthKey : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
