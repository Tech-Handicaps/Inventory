import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import {
  computeHerfindahl,
  generateProcurementInsightBullets,
  type FleetProcurementMetrics,
} from "@/lib/reports/fleet-procurement-insights";
import { prisma } from "@/lib/prisma";

const MS_24_MO = 730 * 24 * 60 * 60 * 1000;
const MS_90_D = 90 * 24 * 60 * 60 * 1000;
const MS_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

// GET /api/reports/hardware-procurement — fleet mix for procurement / stakeholder dashboard
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const [writtenOffStatus, assets] = await Promise.all([
      prisma.assetStatus.findFirst({ where: { code: "written_off" } }),
      prisma.asset.findMany({
        where: {
          NOT: {
            status: { code: "written_off" },
          },
        },
        select: {
          manufacturer: true,
          model: true,
          dateAdded: true,
          purchaseDate: true,
          warrantyEndDate: true,
          deviceTemplate: { select: { label: true, manufacturer: true } },
        },
      }),
    ]);

    const totalRegistered = await prisma.asset.count();
    const totalWrittenOff = writtenOffStatus
      ? await prisma.asset.count({
          where: { statusId: writtenOffStatus.id },
        })
      : 0;

    const totalOperational = assets.length;
    const now = Date.now();

    const byManufacturer = new Map<string, number>();
    const byModel = new Map<
      string,
      { count: number; manufacturer: string | null }
    >();
    const byRegYear = new Map<number, number>();
    const byPurchaseYear = new Map<number, number>();
    let recentRegCount = 0;
    let withPurchaseDate = 0;
    let withWarrantyEnd = 0;
    let sumAgeYears = 0;
    let warrantyExpiring90Days = 0;
    let warrantyExpired = 0;
    let warrantyActiveKnown = 0;

    for (const a of assets) {
      const mfg =
        (a.manufacturer ?? a.deviceTemplate?.manufacturer ?? "").trim() ||
        "Unknown";
      byManufacturer.set(mfg, (byManufacturer.get(mfg) ?? 0) + 1);

      const label =
        a.deviceTemplate?.label?.trim() ||
        `${a.manufacturer?.trim() || "Unknown"} — ${a.model?.trim() || "—"}`;
      const prev = byModel.get(label) ?? {
        count: 0,
        manufacturer: a.manufacturer ?? a.deviceTemplate?.manufacturer ?? null,
      };
      byModel.set(label, {
        count: prev.count + 1,
        manufacturer: prev.manufacturer,
      });

      const regY = new Date(a.dateAdded).getFullYear();
      byRegYear.set(regY, (byRegYear.get(regY) ?? 0) + 1);
      if (now - new Date(a.dateAdded).getTime() <= MS_24_MO) {
        recentRegCount += 1;
      }

      if (a.purchaseDate) {
        withPurchaseDate += 1;
        const p = new Date(a.purchaseDate).getTime();
        sumAgeYears += (now - p) / MS_YEAR;
        const py = new Date(a.purchaseDate).getFullYear();
        byPurchaseYear.set(py, (byPurchaseYear.get(py) ?? 0) + 1);
      }

      if (a.warrantyEndDate) {
        withWarrantyEnd += 1;
        const w = new Date(a.warrantyEndDate).getTime();
        if (w < now) {
          warrantyExpired += 1;
        } else {
          warrantyActiveKnown += 1;
          if (w <= now + MS_90_D) {
            warrantyExpiring90Days += 1;
          }
        }
      }
    }

    const mfgRows = [...byManufacturer.entries()]
      .map(([name, count]) => ({
        name,
        count,
        percent: pct(count, totalOperational),
      }))
      .sort((a, b) => b.count - a.count);

    const modelRows = [...byModel.entries()]
      .map(([label, v]) => ({
        label,
        count: v.count,
        percent: pct(v.count, totalOperational),
        manufacturer: v.manufacturer,
      }))
      .sort((a, b) => b.count - a.count);

    const regYearRows = [...byRegYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({
        year,
        count,
        percent: pct(count, totalOperational),
      }));

    const purchaseYearRows = [...byPurchaseYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({
        year,
        count,
        percent: pct(count, totalOperational),
      }));

    const topManufacturerShare = mfgRows[0]?.percent ?? 0;
    const topThreeModelsShare = modelRows
      .slice(0, 3)
      .reduce((s, x) => s + x.percent, 0);
    const herfindahlManufacturers = computeHerfindahl(
      mfgRows.map((r) => r.percent)
    );

    const purchaseDateCoveragePct = pct(withPurchaseDate, totalOperational);
    const warrantyEndCoveragePct = pct(withWarrantyEnd, totalOperational);
    const averageFleetAgeYears =
      withPurchaseDate > 0 ? sumAgeYears / withPurchaseDate : null;
    const usePurchaseYearForAge = purchaseDateCoveragePct >= 25;

    const metrics: FleetProcurementMetrics = {
      totalOperational,
      totalWrittenOff,
      totalRegistered,
      distinctManufacturers: mfgRows.length,
      distinctModels: modelRows.length,
      topManufacturerShare,
      topThreeModelsShare,
      herfindahlManufacturers,
      registeredLast24MonthsPct: pct(recentRegCount, totalOperational),
      byManufacturer: mfgRows,
      byModel: modelRows.slice(0, 25),
      byRegistrationYear: regYearRows,
      withPurchaseDate,
      withWarrantyEnd,
      purchaseDateCoveragePct,
      warrantyEndCoveragePct,
      averageFleetAgeYears,
      warrantyExpiring90Days,
      warrantyExpired,
      warrantyActiveKnown,
      byPurchaseYear: purchaseYearRows,
      usePurchaseYearForAge,
    };

    const insights = generateProcurementInsightBullets(metrics);

    return NextResponse.json({
      ...metrics,
      insights,
    });
  } catch (error) {
    console.error("GET /api/reports/hardware-procurement", error);
    return NextResponse.json(
      { error: "Failed to build hardware procurement report" },
      { status: 500 }
    );
  }
}
