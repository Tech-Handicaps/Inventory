"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { DataSourceDonutChart } from "@/components/charts/DataSourceDonutChart";
import {
  capSlicesForDonut,
  LabelCountDonutChart,
} from "@/components/charts/LabelCountDonutChart";
import { RegistrationYearChart } from "@/components/charts/RegistrationYearChart";
import { RefurbishedLineChart } from "@/components/charts/RefurbishedLineChart";
import { RepairsBarChart } from "@/components/charts/RepairsBarChart";
import { StockPieChart } from "@/components/charts/StockPieChart";
import { WriteoffsDonutChart } from "@/components/charts/WriteoffsDonutChart";
import { InventoryHeader } from "@/components/InventoryHeader";

type StockRow = { status: string; count: number; code: string };
type StockData = { stock: StockRow[]; total: number };
type RepairsData = {
  pipeline: { status: string; count: number }[];
  repairs: { asset: { assetName: string } }[];
};
type RefurbishedData = { assets: { assetName: string; dateUpdated: string }[] };
type WriteoffsData = {
  assets: { id: string; assetName: string; reason: string | null }[];
  byReason: { reason: string; count: number }[];
  total: number;
};
type DashboardSummary = {
  totalAssets: number;
  byCategory: { category: string; count: number }[];
  byDataSource: { dataSource: string; count: number }[];
  recentAssets: {
    id: string;
    assetName: string;
    category: string;
    dateUpdated: string;
    dataSource: string;
    status: { label: string; code: string };
  }[];
};
type XeroHealth = {
  configured: boolean;
  summary: Record<string, { fixed_asset: number; inventory: number }>;
  recent?: {
    id: string;
    syncStatus: string;
    xeroType: string;
    createdAt: string;
    asset: { assetName: string };
  }[];
};

type AssetGeoReport = {
  totalOperational: number;
  withPublicIp: number;
  withGeo: number;
  publicIpCoveragePct: number;
  geoCoveragePct: number;
  byCountry: { countryCode: string; count: number; percent: number }[];
  byRegion: { label: string; count: number; percent: number }[];
  note: string;
};

type FleetProcurement = {
  totalOperational: number;
  totalWrittenOff: number;
  totalRegistered: number;
  distinctManufacturers: number;
  distinctModels: number;
  topManufacturerShare: number;
  topThreeModelsShare: number;
  herfindahlManufacturers: number;
  registeredLast24MonthsPct: number;
  withPurchaseDate: number;
  withWarrantyEnd: number;
  purchaseDateCoveragePct: number;
  warrantyEndCoveragePct: number;
  averageFleetAgeYears: number | null;
  warrantyExpiring90Days: number;
  warrantyExpired: number;
  warrantyActiveKnown: number;
  byPurchaseYear: { year: number; count: number; percent: number }[];
  usePurchaseYearForAge: boolean;
  byManufacturer: { name: string; count: number; percent: number }[];
  byModel: {
    label: string;
    count: number;
    percent: number;
    manufacturer: string | null;
  }[];
  byRegistrationYear: { year: number; count: number; percent: number }[];
  insights: string[];
};

function countsByCode(stock: StockRow[]): Record<string, number> {
  return Object.fromEntries(stock.map((s) => [s.code, s.count]));
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "default" | "brand" | "sky" | "amber" | "rose";
}) {
  const bar =
    accent === "brand"
      ? "bg-brand"
      : accent === "sky"
        ? "bg-sky-500"
        : accent === "amber"
          ? "bg-amber-500"
          : accent === "rose"
            ? "bg-rose-500"
            : "bg-black/80";
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className={`mb-3 h-1 w-10 rounded-full ${bar}`} />
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/45">
        {label}
      </p>
      <p className="mt-1 font-heading text-3xl font-bold tabular-nums text-black">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-black/50">{hint}</p>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const [stock, setStock] = useState<StockData | null>(null);
  const [repairs, setRepairs] = useState<RepairsData | null>(null);
  const [refurbished, setRefurbished] = useState<RefurbishedData | null>(null);
  const [writeoffs, setWriteoffs] = useState<WriteoffsData | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [xeroHealth, setXeroHealth] = useState<XeroHealth | null>(null);
  const [fleet, setFleet] = useState<FleetProcurement | null>(null);
  const [assetGeo, setAssetGeo] = useState<AssetGeoReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/stock").then((r) => r.json()),
      fetch("/api/reports/repairs").then((r) => r.json()),
      fetch("/api/reports/refurbished").then((r) => r.json()),
      fetch("/api/reports/writeoffs").then((r) => r.json()),
      fetch("/api/reports/dashboard-summary").then(async (r) => {
        const j = await r.json();
        return r.ok ? j : null;
      }),
      fetch("/api/xero/health").then((r) => r.json()),
      fetch("/api/reports/hardware-procurement").then(async (r) => {
        const j = await r.json();
        return r.ok ? j : null;
      }),
      fetch("/api/reports/asset-geo").then(async (r) => {
        const j = await r.json();
        return r.ok ? j : null;
      }),
    ])
      .then(([s, r, ref, w, sum, x, fl, geo]) => {
        setStock(s);
        setRepairs(r);
        setRefurbished(ref);
        setWriteoffs(w);
        setSummary(sum);
        setXeroHealth(x);
        setFleet(fl as FleetProcurement | null);
        setAssetGeo(geo as AssetGeoReport | null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const rows = stock?.stock ?? [];
    const c = countsByCode(rows);
    const depot = (c.new_stock ?? 0) + (c.in_stock ?? 0);
    return {
      total: stock?.total ?? 0,
      depot,
      deployed: c.deployed ?? 0,
      inRepair: c.repair ?? 0,
      writtenOff: c.written_off ?? 0,
    };
  }, [stock]);

  const manufacturerDonutData = useMemo(() => {
    if (!fleet?.byManufacturer?.length) return [];
    return capSlicesForDonut(
      fleet.byManufacturer.map((m) => ({ name: m.name, count: m.count })),
      9
    );
  }, [fleet]);

  const topModelsForChart = useMemo(() => {
    if (!fleet?.byModel?.length) return [];
    return fleet.byModel.slice(0, 14).map((m) => ({
      category: m.label.length > 48 ? `${m.label.slice(0, 46)}…` : m.label,
      count: m.count,
    }));
  }, [fleet]);

  const geoRegionBarData = useMemo(() => {
    if (!assetGeo?.byRegion?.length) return [];
    return assetGeo.byRegion.slice(0, 16).map((row) => ({
      category:
        row.label.length > 56 ? `${row.label.slice(0, 54)}…` : row.label,
      count: row.count,
    }));
  }, [assetGeo]);

  const geoCountryBarData = useMemo(() => {
    if (!assetGeo?.byCountry?.length) return [];
    return assetGeo.byCountry.slice(0, 12).map((row) => ({
      category: row.countryCode,
      count: row.count,
    }));
  }, [assetGeo]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-lg text-black/55">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="dashboard" />

      <main className="mx-auto max-w-7xl space-y-8 p-6">
        <section className="rounded-xl border border-brand/25 bg-brand-muted/30 p-5 shadow-sm">
          <h1 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Operations overview
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/75">
            Live roll-ups from your asset register: lifecycle mix, category
            concentration, Assist vs manual sources, repairs, refurbishment, and
            write-offs. Open{" "}
            <a
              href="/inventory"
              className="font-semibold text-brand underline underline-offset-2"
            >
              Inventory
            </a>{" "}
            to move cards,{" "}
            <a
              href="/assets"
              className="font-semibold text-brand underline underline-offset-2"
            >
              All assets
            </a>{" "}
            for the full table, or{" "}
            <a
              href="/reports#lifecycle"
              className="font-semibold text-brand underline underline-offset-2"
            >
              Reports
            </a>{" "}
            for movement history.
          </p>
        </section>

        {/* KPI strip */}
        <section>
          <h2 className="font-heading mb-3 text-xs font-bold uppercase tracking-[0.15em] text-black/55">
            Key metrics
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Total registered"
              value={kpis.total}
              hint="All lifecycle stages"
            />
            <KpiCard
              label="Depot & shelf"
              value={kpis.depot}
              hint="New stock + in stock"
              accent="brand"
            />
            <KpiCard
              label="Deployed"
              value={kpis.deployed}
              hint="In the field / at site"
              accent="sky"
            />
            <KpiCard
              label="In repair"
              value={kpis.inRepair}
              hint="Asset status: repairs"
              accent="amber"
            />
            <KpiCard
              label="Written off"
              value={kpis.writtenOff}
              hint="Removed from active use"
              accent="rose"
            />
          </div>
        </section>

        {/* Fleet composition & procurement (operational units only) */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Fleet composition & procurement insight
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-black/70">
            <strong>Scope:</strong> operational units only (written-off assets are
            excluded) so percentages reflect what you still manage day to day.{" "}
            <strong>SKU / model</strong> uses the device template label when set;
            otherwise “manufacturer — model” from the asset row.{" "}
            <strong>Purchase date</strong> and <strong>warranty end</strong> (when
            captured on each asset) drive age averages, acquisition cohorts, and
            renewal alerts below. <strong>Registration year</strong> is from{" "}
            <em>date added to this register</em> — useful when purchase dates are
            still missing.
          </p>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />

          {fleet && fleet.totalOperational > 0 ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <KpiCard
                  label="Operational units"
                  value={fleet.totalOperational}
                  hint="Excludes written-off"
                  accent="brand"
                />
                <KpiCard
                  label="Distinct OEMs"
                  value={fleet.distinctManufacturers}
                  hint="Manufacturers in fleet"
                />
                <KpiCard
                  label="Distinct SKUs"
                  value={fleet.distinctModels}
                  hint="Template or make/model groups"
                />
                <KpiCard
                  label="Top OEM share"
                  value={`${Math.round(fleet.topManufacturerShare * 10) / 10}%`}
                  hint="Largest manufacturer"
                  accent="sky"
                />
                <KpiCard
                  label="Top 3 SKUs share"
                  value={`${Math.round(fleet.topThreeModelsShare * 10) / 10}%`}
                  hint="Concentration metric"
                  accent="amber"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Purchase date on file"
                  value={`${Math.round(fleet.purchaseDateCoveragePct * 10) / 10}%`}
                  hint={`${fleet.withPurchaseDate} of ${fleet.totalOperational} units`}
                  accent="brand"
                />
                <KpiCard
                  label="Warranty end on file"
                  value={`${Math.round(fleet.warrantyEndCoveragePct * 10) / 10}%`}
                  hint={`${fleet.withWarrantyEnd} of ${fleet.totalOperational} units`}
                  accent="sky"
                />
                <KpiCard
                  label="Avg age (known purchase)"
                  value={
                    fleet.averageFleetAgeYears != null
                      ? `${Math.round(fleet.averageFleetAgeYears * 10) / 10} yrs`
                      : "—"
                  }
                  hint="Where purchase date exists"
                />
                <KpiCard
                  label="Warranty expiring (90d)"
                  value={fleet.warrantyExpiring90Days}
                  hint="Operational units expiring soon"
                  accent="amber"
                />
              </div>
              <p className="mt-3 text-xs text-black/50">
                Herfindahl (manufacturers):{" "}
                <span className="font-mono tabular-nums">
                  {fleet.herfindahlManufacturers.toFixed(2)}
                </span>{" "}
                — closer to 1 means one dominant OEM; lower values mean a more even
                mix. Added to register in last 24 months:{" "}
                <strong>
                  {Math.round(fleet.registeredLast24MonthsPct * 10) / 10}%
                </strong>{" "}
                of operational fleet.
              </p>

              <div className="mt-8 grid gap-8 xl:grid-cols-2">
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    Manufacturer mix
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    Share of operational units by OEM (donut collapses smaller
                    slices into “Other”).
                  </p>
                  <div className="mx-auto mt-4 h-72 max-w-md">
                    {manufacturerDonutData.length ? (
                      <LabelCountDonutChart
                        data={manufacturerDonutData}
                        unitLabel="units"
                      />
                    ) : null}
                  </div>
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    Top SKUs by count
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    Highest-volume models in the active fleet (see table for exact
                    %).
                  </p>
                  <div className="mt-4 h-80">
                    {topModelsForChart.length ? (
                      <CategoryBarChart data={topModelsForChart} />
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-8 xl:grid-cols-2">
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    Intake by registration year
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    When rows were added to this system — useful for spotting bulk
                    rollouts.
                  </p>
                  <div className="mt-4 h-64">
                    {fleet.byRegistrationYear.length ? (
                      <RegistrationYearChart
                        data={fleet.byRegistrationYear.map((y) => ({
                          year: y.year,
                          count: y.count,
                        }))}
                      />
                    ) : null}
                  </div>
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    Acquisition cohort (purchase year)
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    Units with a purchase date — better for TCO and refresh than
                    register date alone.
                    {fleet.usePurchaseYearForAge
                      ? ""
                      : " Add purchase dates to fill this chart."}
                  </p>
                  <div className="mt-4 h-64">
                    {fleet.byPurchaseYear.length ? (
                      <RegistrationYearChart
                        datasetLabel="Units by purchase date"
                        data={fleet.byPurchaseYear.map((y) => ({
                          year: y.year,
                          count: y.count,
                        }))}
                      />
                    ) : (
                      <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-black/15 px-4 text-center text-sm text-black/45">
                        No purchase dates on operational assets yet — capture on
                        register or edit.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-8 xl:grid-cols-2">
                <div className="rounded-xl border border-black/10 bg-brand-muted/20 p-5">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    Warranty snapshot
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    Based on warranty end dates stored per asset (operational fleet
                    only).
                  </p>
                  <dl className="mt-4 space-y-2 text-sm text-black/85">
                    <div className="flex justify-between gap-4">
                      <dt>Active warranty (end date in future)</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {fleet.warrantyActiveKnown}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Expiring within 90 days</dt>
                      <dd className="font-mono font-semibold tabular-nums text-amber-800">
                        {fleet.warrantyExpiring90Days}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Past recorded end (support at risk)</dt>
                      <dd className="font-mono font-semibold tabular-nums text-black/70">
                        {fleet.warrantyExpired}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    Stakeholder notes
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    Automated heuristics from mix, dates, and warranty — validate
                    against failure data and strategy.
                  </p>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-black/80">
                    {fleet.insights.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 overflow-x-auto rounded-lg border border-black/10">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-black/10 bg-black/[0.02] text-left">
                      <th className="px-3 py-2 font-medium">SKU / model</th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        Units
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        % of operational
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleet.byModel.slice(0, 15).map((m, idx) => (
                      <tr
                        key={`${idx}-${m.label.slice(0, 24)}`}
                        className="border-b border-black/5"
                      >
                        <td className="max-w-md px-3 py-2">{m.label}</td>
                        <td className="px-3 py-2 tabular-nums">{m.count}</td>
                        <td className="px-3 py-2 tabular-nums text-black/70">
                          {m.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-black/55">
              {fleet
                ? "No operational assets to analyse — add hardware or check written-off status."
                : "Could not load fleet procurement data."}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Geographic distribution (GeoIP)
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/70">
            Approximate location from each asset&apos;s <strong>public IP</strong>{" "}
            (offline GeoIP database). Refreshed on Assist import and by the weekly
            sync (Settings → Zoho Assist). VPNs and mobile networks may skew results.
          </p>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />

          {assetGeo && assetGeo.totalOperational > 0 ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="With public IP"
                  value={`${Math.round(assetGeo.publicIpCoveragePct * 10) / 10}%`}
                  hint={`${assetGeo.withPublicIp} of ${assetGeo.totalOperational} operational`}
                  accent="brand"
                />
                <KpiCard
                  label="With geo region"
                  value={`${Math.round(assetGeo.geoCoveragePct * 10) / 10}%`}
                  hint={`${assetGeo.withGeo} of ${assetGeo.totalOperational} operational`}
                  accent="sky"
                />
                <KpiCard
                  label="Countries (distinct)"
                  value={assetGeo.byCountry.length}
                  hint="From resolved IPs"
                />
                <KpiCard
                  label="Regions (distinct)"
                  value={assetGeo.byRegion.length}
                  hint="Subdivision / province bucket"
                  accent="amber"
                />
              </div>
              <p className="mt-3 text-xs text-black/50">{assetGeo.note}</p>

              <div className="mt-8 grid gap-8 xl:grid-cols-2">
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    By region / province (top)
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    Grouped where GeoIP returns a subdivision code (e.g. ZA provinces).
                  </p>
                  <div className="mt-4 h-72">
                    {geoRegionBarData.length ? (
                      <CategoryBarChart data={geoRegionBarData} />
                    ) : (
                      <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-black/15 px-4 text-center text-sm text-black/45">
                        No regional data yet — sync public IPs from Assist or import
                        devices.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                    By country
                  </h3>
                  <p className="mt-1 text-xs text-black/55">
                    ISO country code from GeoIP.
                  </p>
                  <div className="mt-4 h-72">
                    {geoCountryBarData.length ? (
                      <CategoryBarChart data={geoCountryBarData} />
                    ) : (
                      <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-black/15 px-4 text-center text-sm text-black/45">
                        No country data yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-black/55">
              {assetGeo
                ? "No operational assets — add hardware or check written-off status."
                : "Could not load geographic report."}
            </p>
          )}
        </section>

        {/* Primary charts grid */}
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
              Lifecycle mix
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Share of assets by status — colours match the inventory board.
            </p>
            <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
            <div className="mx-auto mt-4 h-[min(320px,45vw)] max-w-md">
              {stock?.stock?.length ? (
                <StockPieChart data={stock.stock} />
              ) : (
                <p className="py-12 text-center text-black/50">
                  No stock data. Add assets or run seed.
                </p>
              )}
            </div>
            {stock ? (
              <p className="mt-2 text-center text-sm text-black/55">
                Total: <strong>{stock.total}</strong> assets
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
              By category
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Count of units per category (e.g. Hardware, AV).
            </p>
            <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
            <div className="mt-4 h-72">
              {summary?.byCategory?.length ? (
                <CategoryBarChart data={summary.byCategory} />
              ) : (
                <p className="flex h-full items-center justify-center text-black/50">
                  No category breakdown.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
              Repair pipeline
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Repair tickets by workflow state (pending → completed).
            </p>
            <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
            <div className="mt-4 h-72">
              {repairs?.pipeline?.length ? (
                <RepairsBarChart data={repairs.pipeline} />
              ) : (
                <p className="flex h-full items-center justify-center text-black/50">
                  No repair tickets yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
              Data source
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Manual registration vs Zoho Assist sync.
            </p>
            <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
            <div className="mx-auto mt-4 h-72 max-w-sm">
              {summary?.byDataSource?.length ? (
                <DataSourceDonutChart data={summary.byDataSource} />
              ) : (
                <p className="flex h-full items-center justify-center text-black/50">
                  No source data.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Trend + recent activity */}
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
              Refurbished trend
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Cumulative refurbished units over time (by last update).
            </p>
            <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
            <div className="mt-4 h-72">
              {refurbished?.assets?.length ? (
                <RefurbishedLineChart data={refurbished.assets} />
              ) : (
                <p className="flex h-full items-center justify-center text-black/50">
                  No refurbished assets.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
              Recent activity
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Last updated assets (name, stage, source).
            </p>
            <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
            {summary?.recentAssets?.length ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-black/8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 bg-black/[0.02] text-left">
                      <th className="px-3 py-2 font-medium">Asset</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentAssets.map((a) => (
                      <tr key={a.id} className="border-b border-black/5">
                        <td className="px-3 py-2 font-medium">{a.assetName}</td>
                        <td className="px-3 py-2 text-black/75">
                          {a.status.label}
                        </td>
                        <td className="px-3 py-2 text-black/65">
                          {a.dataSource === "zoho_assist"
                            ? "Assist"
                            : "Manual"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-black/55">
                          {new Date(a.dateUpdated).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-8 text-center text-black/50">No recent updates.</p>
            )}
          </section>
        </div>

        {/* Write-offs */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Write-offs
          </h2>
          <p className="mt-1 text-sm text-black/55">
            Reasons distribution and latest written-off hardware.
          </p>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="mx-auto max-w-xs lg:mx-0">
              {writeoffs?.byReason?.length ? (
                <WriteoffsDonutChart data={writeoffs.byReason} />
              ) : (
                <p className="py-8 text-center text-black/50">
                  No write-offs by reason.
                </p>
              )}
            </div>
            <div>
              {writeoffs?.assets?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10">
                        <th className="py-2 text-left font-medium">Asset</th>
                        <th className="py-2 text-left font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {writeoffs.assets.slice(0, 10).map((a) => (
                        <tr key={a.id} className="border-b border-black/5">
                          <td className="py-2">{a.assetName}</td>
                          <td className="py-2">{a.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {writeoffs.assets.length > 10 && (
                    <p className="mt-2 text-sm text-black/55">
                      +{writeoffs.assets.length - 10} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-8 text-black/50">No write-offs.</p>
              )}
            </div>
          </div>
          {writeoffs ? (
            <p className="mt-4 text-sm text-black/55">
              Total write-offs: <strong>{writeoffs.total}</strong>
            </p>
          ) : null}
        </section>

        {/* Xero */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Financial sync (Xero)
          </h2>
          <p className="mt-1 text-sm text-black/55">
            Connection status and sync queue by state and asset type.
          </p>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div
              className={`h-3 w-3 rounded-full ${
                xeroHealth?.configured ? "bg-brand" : "bg-amber-500"
              }`}
            />
            <span className="text-sm text-black/80">
              {xeroHealth?.configured
                ? "Xero OAuth credentials present"
                : "Xero not configured — set XERO_CLIENT_ID and XERO_CLIENT_SECRET"}
            </span>
          </div>

          {xeroHealth?.summary &&
          Object.keys(xeroHealth.summary).length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-lg border border-black/10">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b border-black/10 bg-black/[0.03] text-left">
                    <th className="px-4 py-3 font-medium">Sync status</th>
                    <th className="px-4 py-3 font-medium tabular-nums">
                      Fixed asset
                    </th>
                    <th className="px-4 py-3 font-medium tabular-nums">
                      Inventory
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(xeroHealth.summary).map(([status, row]) => (
                    <tr key={status} className="border-b border-black/5">
                      <td className="px-4 py-2 capitalize">{status}</td>
                      <td className="px-4 py-2 tabular-nums text-black/80">
                        {row.fixed_asset}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-black/80">
                        {row.inventory}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 text-sm text-black/50">
              No Xero sync records in the database yet.
            </p>
          )}

          {xeroHealth?.recent && xeroHealth.recent.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-heading text-xs font-bold uppercase tracking-[0.12em] text-black/50">
                Recent sync attempts
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {xeroHealth.recent.slice(0, 8).map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/5 pb-2"
                  >
                    <span className="font-medium text-black">
                      {r.asset.assetName}
                    </span>
                    <span className="text-black/60">
                      {r.xeroType.replace("_", " ")} ·{" "}
                      <span className="capitalize">{r.syncStatus}</span>
                    </span>
                    <span className="w-full text-xs text-black/45 sm:w-auto">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
