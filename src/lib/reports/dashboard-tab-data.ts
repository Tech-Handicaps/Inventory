import { prisma } from "@/lib/prisma";
import { cachedInventoryStat } from "@/lib/cache/inventory-stats";
import { regionNameForCode } from "@/lib/geo/region-display";
import { REPORT_ASSET_LIST_LIMIT } from "@/lib/reports/limits";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

async function computeActivity() {
  const [pipeline, refurbished, recent, writeoffTotal, writeoffs] = await Promise.all([
    prisma.repair.groupBy({ by: ["repairStatus"], _count: { id: true } }),
    prisma.asset.findMany({
      where: { status: { code: "refurbished" } },
      select: { assetName: true, dateUpdated: true },
      orderBy: { dateUpdated: "desc" },
      take: REPORT_ASSET_LIST_LIMIT,
    }),
    prisma.asset.findMany({
      take: 10,
      orderBy: { dateUpdated: "desc" },
      select: {
        id: true,
        assetName: true,
        dateUpdated: true,
        dataSource: true,
        status: { select: { label: true, code: true } },
      },
    }),
    prisma.asset.count({ where: { status: { code: "written_off" } } }),
    prisma.asset.findMany({
      where: { status: { code: "written_off" } },
      select: { id: true, assetName: true, reason: true },
      orderBy: { dateUpdated: "desc" },
      take: REPORT_ASSET_LIST_LIMIT,
    }),
  ]);

  const byReason = new Map<string, number>();
  for (const a of writeoffs) byReason.set(a.reason || "Unspecified", (byReason.get(a.reason || "Unspecified") ?? 0) + 1);

  return {
    repairs: pipeline.map((s) => ({ status: s.repairStatus, count: s._count.id })),
    refurbished: refurbished.map((a) => ({ assetName: a.assetName, dateUpdated: a.dateUpdated.toISOString() })),
    recent: recent.map((a) => ({ ...a, dateUpdated: a.dateUpdated.toISOString() })),
    writeoffs: {
      total: writeoffTotal,
      assets: writeoffs,
      byReason: [...byReason].map(([reason, count]) => ({ reason, count })),
    },
  };
}

async function computeSync() {
  const baseWhere = { NOT: { status: { code: "written_off" } } };
  const [totalOperational, withPublicIp, withGeo, geoRows, xeroByStatus, xeroRecent] = await Promise.all([
    prisma.asset.count({ where: baseWhere }),
    prisma.asset.count({ where: { ...baseWhere, publicIp: { not: null } } }),
    prisma.asset.count({ where: { ...baseWhere, geoCountryCode: { not: null } } }),
    prisma.asset.findMany({
      where: { ...baseWhere, geoCountryCode: { not: null } },
      select: { geoCountryCode: true, geoRegionCode: true, geoRegionName: true },
      take: REPORT_ASSET_LIST_LIMIT,
    }),
    prisma.xeroSync.groupBy({ by: ["syncStatus", "xeroType"], _count: { id: true } }),
    prisma.xeroSync.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: { id: true, syncStatus: true, xeroType: true, createdAt: true, asset: { select: { assetName: true } } },
    }),
  ]);

  const byCountry = new Map<string, number>();
  const byRegion = new Map<string, { label: string; count: number }>();
  for (const a of geoRows) {
    const cc = a.geoCountryCode!.trim();
    const rc = a.geoRegionCode?.trim();
    const rn = a.geoRegionName?.trim();
    byCountry.set(cc, (byCountry.get(cc) ?? 0) + 1);
    const key = rc ? `${cc}|${rc}` : rn ? `${cc}|${rn}` : `${cc}|_`;
    const label = rc || rn ? `${regionNameForCode(cc, rc, rn) ?? rc ?? rn} (${cc})` : `${cc} (region unknown)`;
    const row = byRegion.get(key) ?? { label, count: 0 };
    row.count += 1;
    byRegion.set(key, row);
  }

  const xeroSummary: Record<string, { fixed_asset: number; inventory: number }> = {};
  for (const s of xeroByStatus) {
    xeroSummary[s.syncStatus] ??= { fixed_asset: 0, inventory: 0 };
    xeroSummary[s.syncStatus][s.xeroType as "fixed_asset" | "inventory"] = s._count.id;
  }

  return {
    geo: {
      totalOperational,
      withPublicIp,
      withGeo,
      publicIpCoveragePct: pct(withPublicIp, totalOperational),
      geoCoveragePct: pct(withGeo, totalOperational),
      byCountry: [...byCountry].map(([countryCode, count]) => ({ countryCode, count })).sort((a, b) => b.count - a.count),
      byRegion: [...byRegion.values()].sort((a, b) => b.count - a.count),
    },
    xero: {
      configured: Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET),
      summary: xeroSummary,
      recent: xeroRecent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    },
  };
}

export type DashboardActivity = Awaited<ReturnType<typeof computeActivity>>;
export type DashboardSync = Awaited<ReturnType<typeof computeSync>>;

export const loadDashboardActivity = cachedInventoryStat("dashboard-activity-v1", computeActivity);
export const loadDashboardSync = cachedInventoryStat("dashboard-sync-v1", computeSync);
