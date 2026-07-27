import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { assetSearchText } from "@/lib/inventory/asset-search";
import { nextResponseIfPrismaSchemaDrift } from "@/lib/prisma-error-response";
import { prisma } from "@/lib/prisma";
import { REPORT_ASSET_LIST_LIMIT } from "@/lib/reports/limits";

const assetInclude = {
  status: true,
  deviceTemplate: true,
  club: true,
} as const;

type LifecycleAssetRow = Awaited<
  ReturnType<typeof prisma.asset.findMany<{ include: typeof assetInclude }>>
>[number];

function matchesQuery(asset: LifecycleAssetRow, q: string): boolean {
  const hay = assetSearchText(asset);
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}

/**
 * GET /api/reports/lifecycle-assets
 * Assets for Reports → lifecycle picker. Unlike the generic asset list, this
 * always includes written-off units (they drop out of the recency-sorted top-N).
 *
 * Query: clubId?, q?, limit?
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId")?.trim() || null;
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(
      REPORT_ASSET_LIST_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? "2000", 10) || 2000)
    );

    const writtenOffStatus = await prisma.assetStatus.findFirst({
      where: { code: "written_off" },
      select: { id: true },
    });

    let rows: LifecycleAssetRow[];

    if (clubId) {
      /** All units ever linked to this club — includes written-off history. */
      rows = await prisma.asset.findMany({
        where: { clubId },
        include: assetInclude,
        orderBy: [{ assetName: "asc" }],
        take: limit,
      });
    } else {
      const [writtenOffRows, recentRows] = await Promise.all([
        writtenOffStatus
          ? prisma.asset.findMany({
              where: { statusId: writtenOffStatus.id },
              include: assetInclude,
              orderBy: { assetName: "asc" },
              take: Math.min(500, limit),
            })
          : Promise.resolve([]),
        prisma.asset.findMany({
          where: writtenOffStatus
            ? { NOT: { statusId: writtenOffStatus.id } }
            : {},
          include: assetInclude,
          orderBy: { dateUpdated: "desc" },
          take: limit,
        }),
      ]);

      const byId = new Map<string, LifecycleAssetRow>();
      for (const a of writtenOffRows) byId.set(a.id, a);
      for (const a of recentRows) byId.set(a.id, a);
      rows = [...byId.values()];
    }

    if (q) {
      rows = rows.filter((a) => matchesQuery(a, q));
    }

    rows.sort((a, b) =>
      a.assetName.localeCompare(b.assetName, undefined, { sensitivity: "base" })
    );

    const writtenOffIds = rows
      .filter((a) => a.status.code === "written_off")
      .map((a) => a.id);

    const certByAssetId = new Map<
      string,
      {
        referenceNumber: string;
        replacementRequested: boolean;
        replacementAssetName: string | null;
        clubName: string | null;
      }
    >();

    if (writtenOffIds.length > 0) {
      const certs = await prisma.writeOffCertificate.findMany({
        where: { assetId: { in: writtenOffIds } },
        select: {
          assetId: true,
          referenceNumber: true,
          replacementRequested: true,
          replacementAssetName: true,
          clubName: true,
        },
        orderBy: { createdAt: "desc" },
      });
      for (const c of certs) {
        if (!certByAssetId.has(c.assetId)) {
          certByAssetId.set(c.assetId, c);
        }
      }
    }

    const assets = rows.map((a) => {
      const cert = certByAssetId.get(a.id);
      return {
        ...a,
        writeOffSummary: cert
          ? {
              referenceNumber: cert.referenceNumber,
              replacementRequested: cert.replacementRequested,
              replacementAssetName: cert.replacementAssetName,
              clubName: cert.clubName,
            }
          : null,
      };
    });

    return NextResponse.json({ assets, total: assets.length });
  } catch (error) {
    console.error("GET /api/reports/lifecycle-assets", error);
    const drift = nextResponseIfPrismaSchemaDrift(error);
    if (drift) return drift;
    return NextResponse.json(
      { error: "Failed to fetch lifecycle assets" },
      { status: 500 }
    );
  }
}
