import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { assetsToCsv } from "@/lib/inventory/asset-csv";
import { listAllMatchingAssets } from "@/lib/inventory/asset-query";
import { parseAssetListParams } from "@/lib/inventory/asset-table";

// GET /api/assets/export?<same params as /assets> — CSV of every page for the current filter.
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const params = parseAssetListParams(request.nextUrl.searchParams);
    const assets = await listAllMatchingAssets(params);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(`\uFEFF${assetsToCsv(assets)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hna-assets-${date}.csv"`,
        "Cache-Control": "no-store",
        "X-Total-Count": String(assets.length),
      },
    });
  } catch (e) {
    console.error("GET /api/assets/export", e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
