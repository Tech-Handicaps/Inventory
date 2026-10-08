import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { FINANCE_PACK_BUCKET } from "@/lib/reports/finance-month-pack";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/finance-packs/pdf?month=2026-09&kind=reconcile|breakdown|month-on-month|yearly|field&download=1
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  const month = request.nextUrl.searchParams.get("month") ?? "";
  const kind = request.nextUrl.searchParams.get("kind");
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Month must be YYYY-MM" }, { status: 400 });
  }
  if (
    kind !== "reconcile" &&
    kind !== "breakdown" &&
    kind !== "month-on-month" &&
    kind !== "yearly" &&
    kind !== "field"
  ) {
    return NextResponse.json(
      {
        error:
          "Kind must be reconcile, breakdown, month-on-month, yearly, or field",
      },
      { status: 400 }
    );
  }

  try {
    const pack = await prisma.financeMonthPack.findUnique({
      where: { monthKey: month },
    });
    if (!pack) {
      return NextResponse.json(
        { error: "No official finance pack is stored for that month" },
        { status: 404 }
      );
    }

    const path =
      kind === "reconcile"
        ? pack.reconcileStoragePath
        : kind === "breakdown"
          ? pack.breakdownStoragePath
          : kind === "month-on-month"
            ? pack.monthOnMonthStoragePath
            : kind === "yearly"
              ? pack.yearlyStoragePath
              : pack.fieldListingStoragePath;
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(FINANCE_PACK_BUCKET)
      .download(path);
    if (error || !data) {
      console.error("GET /api/reports/finance-packs/pdf", error);
      return NextResponse.json(
        { error: "The stored PDF could not be opened" },
        { status: 500 }
      );
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const filename =
      kind === "reconcile"
        ? `hna-monthly-stock-reconcile-${month}.pdf`
        : kind === "breakdown"
          ? `hna-stock-breakdown-${month}.pdf`
          : kind === "month-on-month"
            ? `hna-finance-month-on-month-${month}.pdf`
            : kind === "yearly"
              ? `hna-finance-yearly-${month}.pdf`
              : `hna-finance-field-listing-${month}.pdf`;
    const asAttachment = request.nextUrl.searchParams.has("download");
    const disposition = asAttachment
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/reports/finance-packs/pdf", error);
    return NextResponse.json(
      { error: "Failed to open the stored finance pack" },
      { status: 500 }
    );
  }
}
