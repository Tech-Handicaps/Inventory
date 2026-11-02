import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { createAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/prisma";
import { FINANCE_PACK_BUCKET } from "@/lib/reports/finance-month-pack";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["reconcile", "breakdown", "month-on-month", "yearly", "field", "csv"] as const;
type Kind = (typeof KINDS)[number];

const FILE_NAMES: Record<Kind, string> = {
  reconcile: "hna-monthly-stock-reconcile",
  breakdown: "hna-stock-breakdown",
  "month-on-month": "hna-finance-month-on-month",
  yearly: "hna-finance-yearly",
  field: "hna-finance-field-listing",
  csv: "hna-finance-pack",
};

/**
 * GET /api/reports/finance-packs/pdf?month=2026-10&kind=reconcile|breakdown|month-on-month|yearly|field|csv&download=1
 * The stored file, unchanged. Every open is audit-logged.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  const month = request.nextUrl.searchParams.get("month") ?? "";
  const kind = request.nextUrl.searchParams.get("kind") as Kind | null;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Month must be YYYY-MM" }, { status: 400 });
  }
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: `Kind must be one of: ${KINDS.join(", ")}` }, { status: 400 });
  }

  try {
    const pack = await prisma.financeMonthPack.findUnique({ where: { monthKey: month } });
    if (!pack) {
      return NextResponse.json({ error: "No official finance pack is stored for that month" }, { status: 404 });
    }

    const path: string | null = {
      reconcile: pack.reconcileStoragePath,
      breakdown: pack.breakdownStoragePath,
      "month-on-month": pack.monthOnMonthStoragePath,
      yearly: pack.yearlyStoragePath,
      field: pack.fieldListingStoragePath,
      csv: pack.csvStoragePath,
    }[kind];
    if (!path) {
      return NextResponse.json({ error: "This pack was stored without that file" }, { status: 404 });
    }

    const { data, error } = await createSupabaseAdmin().storage.from(FINANCE_PACK_BUCKET).download(path);
    if (error || !data) {
      console.error("GET /api/reports/finance-packs/pdf", error);
      return NextResponse.json({ error: "The stored file could not be opened" }, { status: 500 });
    }

    await createAuditLog({
      userId: auth.user.id,
      actionType: "report.pack_downloaded",
      notes: `${pack.monthEndingLabel} — ${kind} opened`,
      metadata: { monthKey: month, kind, path },
    });

    const isCsv = kind === "csv";
    const filename = `${FILE_NAMES[kind]}-${month}.${isCsv ? "csv" : "pdf"}`;
    const asAttachment = isCsv || request.nextUrl.searchParams.has("download");
    const hashes = (pack.fileHashes ?? {}) as Record<string, string>;
    const headers: Record<string, string> = {
      "Content-Type": isCsv ? "text/csv; charset=utf-8" : "application/pdf",
      "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    };
    if (hashes[path]) headers["X-Content-SHA256"] = hashes[path];

    return new NextResponse(new Uint8Array(await data.arrayBuffer()), { status: 200, headers });
  } catch (error) {
    console.error("GET /api/reports/finance-packs/pdf", error);
    return NextResponse.json({ error: "Failed to open the stored finance pack" }, { status: 500 });
  }
}
