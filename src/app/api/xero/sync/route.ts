import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit/audit-log";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

// POST /api/xero/sync - Trigger sync with Xero (fixed assets + inventory)
// Placeholder: full implementation requires Xero OAuth2 + API calls
export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  try {
    const body = (await request.json().catch(() => ({}))) as { assetIds?: string[] };
    const assetIds = body.assetIds as string[] | undefined;

    // For now: create pending XeroSync records; real sync would call Xero API
    const assets = assetIds?.length
      ? await prisma.asset.findMany({ where: { id: { in: assetIds } } })
      : await prisma.asset.findMany({ take: 100 });

    const syncs: { id: string }[] = [];
    for (const a of assets) {
      const [fa, inv] = await Promise.all([
        prisma.xeroSync.create({
          data: { assetId: a.id, xeroType: "fixed_asset", syncStatus: "pending" },
        }),
        prisma.xeroSync.create({
          data: { assetId: a.id, xeroType: "inventory", syncStatus: "pending" },
        }),
      ]);
      syncs.push(fa, inv);
    }

    await createAuditLog({
      userId: user.id,
      actionType: "integration.xero.sync_triggered",
      notes: "Xero sync placeholder — pending sync rows created",
      metadata: {
        assetCount: assets.length,
        pendingSyncRecordCount: syncs.length,
        filteredByAssetIds: !!(assetIds?.length),
      },
    });

    return NextResponse.json({
      message:
        "Sync triggered (placeholder - configure Xero OAuth2 for real sync)",
      pendingCount: syncs.length,
    });
  } catch (error) {
    console.error("POST /api/xero/sync", error);
    return NextResponse.json(
      { error: "Failed to trigger Xero sync" },
      { status: 500 }
    );
  }
}
