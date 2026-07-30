import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { ASSET_TAG_CATALOG } from "@/lib/inventory/asset-tag-catalog";
import {
  assetTagsForDisplay,
  mergeTagSuggestions,
} from "@/lib/inventory/asset-tags";
import { prisma } from "@/lib/prisma";

/** GET /api/asset-tags — catalog + tags already used on assets and templates */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const [assets, templates] = await Promise.all([
      prisma.asset.findMany({ select: { tags: true, category: true } }),
      prisma.deviceTemplate.findMany({ select: { tags: true, category: true } }),
    ]);

    const fromDb: string[] = [];
    for (const row of [...assets, ...templates]) {
      fromDb.push(...assetTagsForDisplay(row.tags, row.category));
    }

    return NextResponse.json({
      suggestions: mergeTagSuggestions(ASSET_TAG_CATALOG, fromDb),
      groups: ASSET_TAG_CATALOG,
    });
  } catch (error) {
    console.error("GET /api/asset-tags", error);
    return NextResponse.json(
      { error: "Failed to load tag suggestions" },
      { status: 500 }
    );
  }
}
