import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { sendMonthlyReconcileReport } from "@/lib/reports/send-monthly-reconcile";

export const maxDuration = 120;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Daily job: once a month has closed in Africa/Johannesburg, store that month's official
 * pack and email it to finance once. Runs every day so a missed or failed run catches up.
 * Vercel Cron: GET with Authorization: Bearer CRON_SECRET.
 * Manual: POST while signed in as admin sends a test of the current month (not stored).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendMonthlyReconcileReport({ mode: "cron" });
    return NextResponse.json(result);
  } catch (e) {
    console.error("cron send-monthly-reconcile", e);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "super_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const result = await sendMonthlyReconcileReport({
      mode: "manual_test",
      force: true,
      userId: auth.user.id,
    });
    if (!result.ok && result.error) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST send-monthly-reconcile", e);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
