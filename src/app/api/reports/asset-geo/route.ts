import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { regionNameForCode } from "@/lib/geo/region-display";
import { nextResponseIfPrismaSchemaDrift } from "@/lib/prisma-error-response";
import { prisma } from "@/lib/prisma";

/** GET /api/reports/asset-geo — distribution by country / region for dashboard & reporting */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const writtenOff = await prisma.assetStatus.findFirst({
      where: { code: "written_off" },
    });

    const baseWhere =
      writtenOff != null
        ? { NOT: { statusId: writtenOff.id } }
        : {};

    const [
      totalOperational,
      withPublicIp,
      withGeo,
      assets,
    ] = await Promise.all([
      prisma.asset.count({ where: baseWhere }),
      prisma.asset.count({
        where: { ...baseWhere, publicIp: { not: null } },
      }),
      prisma.asset.count({
        where: { ...baseWhere, geoCountryCode: { not: null } },
      }),
      prisma.asset.findMany({
        where: baseWhere,
        select: {
          geoCountryCode: true,
          geoRegionCode: true,
          geoRegionName: true,
          geoCity: true,
        },
      }),
    ]);

    const byCountry = new Map<string, number>();
    const byRegion = new Map<string, { label: string; count: number }>();

    for (const a of assets) {
      const cc = a.geoCountryCode?.trim();
      const rc = a.geoRegionCode?.trim();
      const rn = a.geoRegionName?.trim();
      if (cc) {
        byCountry.set(cc, (byCountry.get(cc) ?? 0) + 1);
      }
      if (cc && (rc || rn)) {
        const name = regionNameForCode(cc, rc, rn) ?? rc ?? rn;
        const key = rc ? `${cc}|${rc}` : `${cc}|${rn}`;
        const prev = byRegion.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          byRegion.set(key, { label: `${name} (${cc})`, count: 1 });
        }
      } else if (cc && !rc && !rn) {
        const key = `${cc}|_`;
        const prev = byRegion.get(key);
        if (prev) {
          prev.count += 1;
        } else {
          byRegion.set(key, { label: `${cc} (region unknown)`, count: 1 });
        }
      }
    }

    const countryRows = [...byCountry.entries()]
      .map(([countryCode, count]) => ({
        countryCode,
        count,
        percent:
          totalOperational > 0
            ? Math.round((count / totalOperational) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const regionRows = [...byRegion.values()]
      .map((r) => ({
        ...r,
        percent:
          totalOperational > 0
            ? Math.round((r.count / totalOperational) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalOperational,
      withPublicIp,
      withGeo,
      publicIpCoveragePct:
        totalOperational > 0
          ? Math.round((withPublicIp / totalOperational) * 1000) / 10
          : 0,
      geoCoveragePct:
        totalOperational > 0
          ? Math.round((withGeo / totalOperational) * 1000) / 10
          : 0,
      byCountry: countryRows,
      byRegion: regionRows,
      note:
        "Locations are derived from public IP (GeoIP). VPNs and mobile networks may skew regions.",
    });
  } catch (error) {
    console.error("GET /api/reports/asset-geo", error);
    const drift = nextResponseIfPrismaSchemaDrift(error);
    if (drift) return drift;
    return NextResponse.json(
      { error: "Failed to load geo report" },
      { status: 500 }
    );
  }
}
