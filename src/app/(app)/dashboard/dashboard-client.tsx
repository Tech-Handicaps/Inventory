"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardSkeleton } from "@/components/Skeleton";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { useHandicaper } from "@/components/HandicaperProvider";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { MessageCircleQuestion } from "lucide-react";
import { formatDateTime } from "@/lib/dates/format";

type StockRow = { status: string; count: number; code: string };
type StockAvailableBucket = {
  new_stock: number;
  refurbished: number;
  total: number;
};
type StockAvailable = {
  all: StockAvailableBucket;
  hardware: StockAvailableBucket;
  usb_hid_msr: StockAvailableBucket;
  other: StockAvailableBucket;
};
type StockData = { stock: StockRow[]; total: number; available: StockAvailable };
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
  metricKey,
  onExplain,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "default" | "brand" | "sky" | "amber" | "rose";
  metricKey?: string;
  onExplain?: (metricKey: string, label: string) => void;
}) {
  const clickable = Boolean(metricKey && onExplain);
  return (
    <div
      className={`kpi-card group p-4 ${clickable ? "cursor-pointer transition hover:ring-2 hover:ring-brand/30" : ""}`}
      aria-label={clickable ? `${label}: ${value}. Ask Handicaper to explain` : undefined}
      onClick={clickable ? () => onExplain!(metricKey!, label) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onExplain!(metricKey!, label);
              }
            }
          : undefined
      }
      title={clickable ? "Ask Handicaper to explain this figure" : undefined}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-medium text-muted">
          {label}
        </p>
        {clickable ? (
          <MessageCircleQuestion
            className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden
          />
        ) : null}
      </div>
      <p className="mt-1 font-heading text-3xl font-bold tabular-nums text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Last bundle for this tab session, shown instantly while a fresh one loads. */
const DASHBOARD_CACHE_KEY = "hna:dashboard-bundle";

export type DashboardBundle = Partial<
  Record<
    "stock" | "repairs" | "refurbished" | "writeoffs" | "summary" | "xeroHealth" | "fleet" | "assetGeo",
    { data: unknown; error: string | null }
  >
>;

function readBundle(bundle: DashboardBundle) {
  const section = <T,>(key: keyof DashboardBundle) => (bundle[key]?.data ?? null) as T | null;
  const results = Object.values(bundle);
  const failures = results.filter((row) => row?.error);
  const error =
    results.length > 0 && failures.length === results.length
      ? (failures[0]?.error ?? "Failed to load dashboard")
      : failures.length > 0
        ? `Some dashboard sections failed to load (${failures.length} of ${results.length}). Showing available data.`
        : null;
  return {
    stock: section<StockData>("stock"),
    repairs: section<RepairsData>("repairs"),
    refurbished: section<RefurbishedData>("refurbished"),
    writeoffs: section<WriteoffsData>("writeoffs"),
    summary: section<DashboardSummary>("summary"),
    xeroHealth: section<XeroHealth>("xeroHealth"),
    fleet: section<FleetProcurement>("fleet"),
    assetGeo: section<AssetGeoReport>("assetGeo"),
    error,
  };
}

/** `initialBundle` comes from the server render; null means load in the browser. */
export function DashboardView({ initialBundle }: { initialBundle: DashboardBundle | null }) {
  const [initial] = useState(() => (initialBundle ? readBundle(initialBundle) : null));
  const [stock, setStock] = useState<StockData | null>(initial?.stock ?? null);
  const [repairs, setRepairs] = useState<RepairsData | null>(initial?.repairs ?? null);
  const [refurbished, setRefurbished] = useState<RefurbishedData | null>(initial?.refurbished ?? null);
  const [writeoffs, setWriteoffs] = useState<WriteoffsData | null>(initial?.writeoffs ?? null);
  const [summary, setSummary] = useState<DashboardSummary | null>(initial?.summary ?? null);
  const [xeroHealth, setXeroHealth] = useState<XeroHealth | null>(initial?.xeroHealth ?? null);
  const [fleet, setFleet] = useState<FleetProcurement | null>(initial?.fleet ?? null);
  const [assetGeo, setAssetGeo] = useState<AssetGeoReport | null>(initial?.assetGeo ?? null);
  const [loading, setLoading] = useState(initial === null);
  const [loadError, setLoadError] = useState<string | null>(initial?.error ?? null);
  const { openMetric } = useHandicaper();

  useEffect(() => {
    if (initialBundle) {
      try {
        sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(initialBundle));
      } catch {
        /* storage full or disabled */
      }
      return;
    }
    let cancelled = false;

    function apply(bundle: DashboardBundle) {
      const next = readBundle(bundle);
      setStock(next.stock);
      setRepairs(next.repairs);
      setRefurbished(next.refurbished);
      setWriteoffs(next.writeoffs);
      setSummary(next.summary);
      setXeroHealth(next.xeroHealth);
      setFleet(next.fleet);
      setAssetGeo(next.assetGeo);
      setLoadError(next.error);
      setLoading(false);
    }

    const frame = requestAnimationFrame(() => {
      try {
        const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
        if (cached && !cancelled) apply(JSON.parse(cached) as DashboardBundle);
      } catch {
        /* ignore unreadable cache */
      }
    });

    void (async () => {
      try {
        const r = await fetch("/api/reports/dashboard-bundle");
        const j = (await r.json().catch(() => null)) as DashboardBundle | { error?: string } | null;
        if (cancelled) return;
        if (!r.ok || !j) {
          const msg = j && "error" in j && typeof j.error === "string" ? j.error : "Failed to load dashboard";
          setLoadError(msg);
          setLoading(false);
          return;
        }
        apply(j as DashboardBundle);
        try {
          sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(j));
        } catch {
          /* storage full or disabled */
        }
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load dashboard");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [initialBundle]);

  const kpis = useMemo(() => {
    const rows = stock?.stock ?? [];
    const c = countsByCode(rows);
    const available = stock?.available;
    const computers = available?.hardware ?? {
      new_stock: 0,
      refurbished: 0,
      total: 0,
    };
    const cardReaders = available?.usb_hid_msr ?? {
      new_stock: 0,
      refurbished: 0,
      total: 0,
    };
    return {
      total: stock?.total ?? 0,
      computersAvailable: computers.total,
      computersNew: computers.new_stock,
      computersRefurbished: computers.refurbished,
      cardReadersAvailable: cardReaders.total,
      cardReadersNew: cardReaders.new_stock,
      cardReadersRefurbished: cardReaders.refurbished,
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
    return <DashboardSkeleton />;
  }

  const hardFail =
    Boolean(loadError) &&
    !stock &&
    !repairs &&
    !refurbished &&
    !writeoffs &&
    !summary &&
    !xeroHealth &&
    !fleet &&
    !assetGeo;

  if (hardFail) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="font-heading text-lg font-bold text-ink">
          Dashboard unavailable
        </h1>
        <p className="mt-2 text-sm text-red-800" role="alert">
          {loadError}
        </p>
        <button
          type="button"
          className="btn-primary mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <>
    <main className="mx-auto max-w-7xl space-y-8 p-6">
        {loadError ? (
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            {loadError}{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : null}
        <PageHeader
          title="Operations overview"
          description="Live roll-ups from your asset register."
          help={
            <>
              Lifecycle mix, category concentration, Assist vs manual sources,
              repairs, refurbishment and write-offs. Open{" "}
              <a href="/inventory" className="font-semibold text-brand-deep underline underline-offset-2">
                Inventory
              </a>{" "}
              to move cards,{" "}
              <a href="/assets" className="font-semibold text-brand-deep underline underline-offset-2">
                All assets
              </a>{" "}
              for the full table, or{" "}
              <a href="/reports#lifecycle" className="font-semibold text-brand-deep underline underline-offset-2">
                Reports
              </a>{" "}
              for movement history.
            </>
          }
        />

        {/* KPI strip */}
        <section>
          <h2 className="font-heading mb-3 text-xs font-bold text-muted">
            Key metrics
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <KpiCard
              label="Total registered"
              value={kpis.total}
              hint="All lifecycle stages"
              metricKey="totalRegistered"
              onExplain={openMetric}
            />
            <KpiCard
              label="Terminals / Computers / AIO available"
              value={kpis.computersAvailable}
              hint={`New ${kpis.computersNew} · Refurb ${kpis.computersRefurbished}`}
              accent="brand"
              metricKey="computersAvailable"
              onExplain={openMetric}
            />
            <KpiCard
              label="Card readers available"
              value={kpis.cardReadersAvailable}
              hint={`New ${kpis.cardReadersNew} · Refurb ${kpis.cardReadersRefurbished}`}
              accent="amber"
              metricKey="cardReadersAvailable"
              onExplain={openMetric}
            />
            <KpiCard
              label="Deployed"
              value={kpis.deployed}
              hint="In the field / at site"
              accent="sky"
              metricKey="deployed"
              onExplain={openMetric}
            />
            <KpiCard
              label="In repair"
              value={kpis.inRepair}
              hint="Asset status: repairs"
              accent="amber"
              metricKey="inRepair"
              onExplain={openMetric}
            />
            <KpiCard
              label="Written off"
              value={kpis.writtenOff}
              hint="Removed from active use"
              accent="rose"
              metricKey="writtenOff"
              onExplain={openMetric}
            />
          </div>
        </section>

        {/* Fleet composition & procurement (operational units only) */}
        <section className="section-card p-6">
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading text-lg font-bold text-ink">
              Fleet composition & procurement insight
            </h2>
            <InfoTip label="About fleet composition">
              <strong>SKU / model</strong> groups units by manufacturer + model
              (from the asset row or linked device template), not deployment names
              like HNA-CLUB-01. <strong>Purchase date</strong> and{" "}
              <strong>warranty end</strong> drive age averages, acquisition cohorts
              and renewal alerts. <strong>Registration year</strong> is the date
              added to this register, useful when purchase dates are missing.
            </InfoTip>
          </div>
          <p className="mt-1 text-sm text-muted">
            Operational units only; written-off assets are excluded.
          </p>

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
              <p className="mt-3 text-xs text-muted">
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
                  <h3 className="font-heading text-sm font-bold text-ink">
                    Manufacturer mix
                  </h3>
                  <p className="mt-1 text-xs text-muted">
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
                  <h3 className="font-heading text-sm font-bold text-ink">
                    Top SKUs by count
                  </h3>
                  <p className="mt-1 text-xs text-muted">
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
                  <h3 className="font-heading text-sm font-bold text-ink">
                    Intake by registration year
                  </h3>
                  <p className="mt-1 text-xs text-muted">
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
                  <h3 className="font-heading text-sm font-bold text-ink">
                    Acquisition cohort (purchase year)
                  </h3>
                  <p className="mt-1 text-xs text-muted">
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
                      <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
                        No purchase dates on operational assets yet — capture on
                        register or edit.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-8 xl:grid-cols-2">
                <div className="rounded-lg border border-line bg-brand-muted/20 p-5">
                  <h3 className="font-heading text-sm font-bold text-ink">
                    Warranty snapshot
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    Based on warranty end dates stored per asset (operational fleet
                    only).
                  </p>
                  <dl className="mt-4 space-y-2 text-sm text-ink">
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
                      <dd className="font-mono font-semibold tabular-nums text-ink">
                        {fleet.warrantyExpired}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-ink">
                    Stakeholder notes
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    Automated heuristics from mix, dates, and warranty — validate
                    against failure data and strategy.
                  </p>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink">
                    {fleet.insights.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-black/[0.02] text-left">
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
                        className="border-b border-line"
                      >
                        <td className="max-w-md px-3 py-2">{m.label}</td>
                        <td className="px-3 py-2 tabular-nums">{m.count}</td>
                        <td className="px-3 py-2 tabular-nums text-ink">
                          {m.percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted">
              {fleet
                ? "No operational assets to analyse — add hardware or check written-off status."
                : "Could not load fleet procurement data."}
            </p>
          )}
        </section>

        <section className="section-card p-6">
          <h2 className="font-heading text-lg font-bold text-ink">
            Geographic distribution (GeoIP)
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">
            Approximate location from each asset&apos;s <strong>public IP</strong>{" "}
            (offline GeoIP database). Refreshed on Assist import and by the weekly
            sync (Settings → Zoho Assist). VPNs and mobile networks may skew results.
          </p>

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
              <p className="mt-3 text-xs text-muted">{assetGeo.note}</p>

              <div className="mt-8 grid gap-8 xl:grid-cols-2">
                <div>
                  <h3 className="font-heading text-sm font-bold text-ink">
                    By region / province (top)
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    Grouped where GeoIP returns a subdivision code (e.g. ZA provinces).
                  </p>
                  <div className="mt-4 h-72">
                    {geoRegionBarData.length ? (
                      <CategoryBarChart data={geoRegionBarData} />
                    ) : (
                      <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
                        No regional data yet — sync public IPs from Assist or import
                        devices.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-ink">
                    By country
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    ISO country code from GeoIP.
                  </p>
                  <div className="mt-4 h-72">
                    {geoCountryBarData.length ? (
                      <CategoryBarChart data={geoCountryBarData} />
                    ) : (
                      <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
                        No country data yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted">
              {assetGeo
                ? "No operational assets — add hardware or check written-off status."
                : "Could not load geographic report."}
            </p>
          )}
        </section>

        {/* Primary charts grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="section-card p-6">
            <h2 className="font-heading text-lg font-bold text-ink">
              Lifecycle mix
            </h2>
            <p className="mt-1 text-sm text-muted">
              Share of assets by status — colours match the inventory board.
            </p>
            <div className="mx-auto mt-4 h-[min(320px,45vw)] max-w-md">
              {stock?.stock?.length ? (
                <StockPieChart data={stock.stock} />
              ) : (
                <p className="py-12 text-center text-muted">
                  No stock data. Add assets or run seed.
                </p>
              )}
            </div>
            {stock ? (
              <p className="mt-2 text-center text-sm text-muted">
                Total: <strong>{stock.total}</strong> assets
              </p>
            ) : null}
          </section>

          <section className="section-card p-6">
            <h2 className="font-heading text-lg font-bold text-ink">
              By category
            </h2>
            <p className="mt-1 text-sm text-muted">
              Count of units per category (e.g. Hardware, AV).
            </p>
            <div className="mt-4 h-72">
              {summary?.byCategory?.length ? (
                <CategoryBarChart data={summary.byCategory} />
              ) : (
                <p className="flex h-full items-center justify-center text-muted">
                  No category breakdown.
                </p>
              )}
            </div>
          </section>

          <section className="section-card p-6">
            <h2 className="font-heading text-lg font-bold text-ink">
              Repair pipeline
            </h2>
            <p className="mt-1 text-sm text-muted">
              Repair tickets by workflow state (pending → completed).
            </p>
            <div className="mt-4 h-72">
              {repairs?.pipeline?.length ? (
                <RepairsBarChart data={repairs.pipeline} />
              ) : (
                <p className="flex h-full items-center justify-center text-muted">
                  No repair tickets yet.
                </p>
              )}
            </div>
          </section>

          <section className="section-card p-6">
            <h2 className="font-heading text-lg font-bold text-ink">
              Data source
            </h2>
            <p className="mt-1 text-sm text-muted">
              Manual registration vs Zoho Assist sync.
            </p>
            <div className="mx-auto mt-4 h-72 max-w-sm">
              {summary?.byDataSource?.length ? (
                <DataSourceDonutChart data={summary.byDataSource} />
              ) : (
                <p className="flex h-full items-center justify-center text-muted">
                  No source data.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Trend + recent activity */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="section-card p-6">
            <h2 className="font-heading text-lg font-bold text-ink">
              Refurbished trend
            </h2>
            <p className="mt-1 text-sm text-muted">
              Cumulative refurbished units over time (by last update).
            </p>
            <div className="mt-4 h-72">
              {refurbished?.assets?.length ? (
                <RefurbishedLineChart data={refurbished.assets} />
              ) : (
                <p className="flex h-full items-center justify-center text-muted">
                  No refurbished assets.
                </p>
              )}
            </div>
          </section>

          <section className="section-card p-6">
            <h2 className="font-heading text-lg font-bold text-ink">
              Recent activity
            </h2>
            <p className="mt-1 text-sm text-muted">
              Last updated assets (name, stage, source).
            </p>
            {summary?.recentAssets?.length ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-black/[0.02] text-left">
                      <th className="px-3 py-2 font-medium">Asset</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentAssets.map((a) => (
                      <tr key={a.id} className="border-b border-line">
                        <td className="px-3 py-2 font-medium">{a.assetName}</td>
                        <td className="px-3 py-2 text-ink">
                          {a.status.label}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {a.dataSource === "zoho_assist"
                            ? "Assist"
                            : "Manual"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                          {formatDateTime(a.dateUpdated)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-8 text-center text-muted">No recent updates.</p>
            )}
          </section>
        </div>

        {/* Write-offs */}
        <section className="section-card p-6">
          <h2 className="font-heading text-lg font-bold text-ink">
            Write-offs
          </h2>
          <p className="mt-1 text-sm text-muted">
            Reasons distribution and latest written-off hardware.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="mx-auto max-w-xs lg:mx-0">
              {writeoffs?.byReason?.length ? (
                <WriteoffsDonutChart data={writeoffs.byReason} />
              ) : (
                <p className="py-8 text-center text-muted">
                  No write-offs by reason.
                </p>
              )}
            </div>
            <div>
              {writeoffs?.assets?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="py-2 text-left font-medium">Asset</th>
                        <th className="py-2 text-left font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {writeoffs.assets.slice(0, 10).map((a) => (
                        <tr key={a.id} className="border-b border-line">
                          <td className="py-2">{a.assetName}</td>
                          <td className="py-2">{a.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {writeoffs.assets.length > 10 && (
                    <p className="mt-2 text-sm text-muted">
                      +{writeoffs.assets.length - 10} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-8 text-muted">No write-offs.</p>
              )}
            </div>
          </div>
          {writeoffs ? (
            <p className="mt-4 text-sm text-muted">
              Total write-offs: <strong>{writeoffs.total}</strong>
            </p>
          ) : null}
        </section>

        {/* Xero */}
        <section className="section-card p-6">
          <h2 className="font-heading text-lg font-bold text-ink">
            Financial sync (Xero)
          </h2>
          <p className="mt-1 text-sm text-muted">
            Connection status and sync queue by state and asset type.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div
              className={`h-3 w-3 rounded-full ${
                xeroHealth?.configured ? "bg-brand" : "bg-amber-500"
              }`}
            />
            <span className="text-sm text-ink">
              {xeroHealth?.configured
                ? "Xero OAuth credentials present"
                : "Xero not configured — set XERO_CLIENT_ID and XERO_CLIENT_SECRET"}
            </span>
          </div>

          {xeroHealth?.summary &&
          Object.keys(xeroHealth.summary).length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-black/[0.03] text-left">
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
                    <tr key={status} className="border-b border-line">
                      <td className="px-4 py-2 capitalize">{status}</td>
                      <td className="px-4 py-2 tabular-nums text-ink">
                        {row.fixed_asset}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-ink">
                        {row.inventory}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">
              No Xero sync records in the database yet.
            </p>
          )}

          {xeroHealth?.recent && xeroHealth.recent.length > 0 ? (
            <div className="mt-6">
              <h3 className="font-heading text-xs font-bold text-muted">
                Recent sync attempts
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {xeroHealth.recent.slice(0, 8).map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2"
                  >
                    <span className="font-medium text-ink">
                      {r.asset.assetName}
                    </span>
                    <span className="text-muted">
                      {r.xeroType.replace("_", " ")} ·{" "}
                      <span className="capitalize">{r.syncStatus}</span>
                    </span>
                    <span className="w-full text-xs text-muted sm:w-auto">
                      {formatDateTime(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}
