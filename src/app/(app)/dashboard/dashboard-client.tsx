"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SkeletonBlock } from "@/components/Skeleton";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { useHandicaper } from "@/components/HandicaperProvider";
import { DataSourceDonutChart } from "@/components/charts/DataSourceDonutChart";
import { RegistrationYearChart } from "@/components/charts/RegistrationYearChart";
import { RefurbishedLineChart } from "@/components/charts/RefurbishedLineChart";
import { RepairsBarChart } from "@/components/charts/RepairsBarChart";
import { WriteoffsDonutChart } from "@/components/charts/WriteoffsDonutChart";
import {
  CoverageFigure,
  DataQualityCard,
  KpiTile,
  ManufacturerDonut,
  StageBar,
  TopModels,
} from "@/components/dashboard/OverviewSections";
import { PageHeader } from "@/components/ui/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { formatDateTime } from "@/lib/dates/format";
import { AVAILABLE_STATUS_PARAM } from "@/lib/inventory/asset-table";
import type { DashboardOverview } from "@/lib/reports/dashboard-overview-summary";
import { DASHBOARD_TABS, type DashboardTab } from "@/lib/reports/dashboard-tabs";

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

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Plain figure card for the secondary tabs. */
function Stat({
  label,
  value,
  hint,
  help,
  muted,
}: {
  label: string;
  value: number | string;
  hint?: string;
  help?: string;
  muted?: boolean;
}) {
  return (
    <div className={`kpi-card p-4 ${muted ? "bg-black/[0.02]" : ""}`}>
      <p className="flex items-center gap-1 text-xs font-medium text-muted">
        {label}
        {help ? <InfoTip label={`About ${label}`}>{help}</InfoTip> : null}
      </p>
      <p className={`mt-1 font-heading text-2xl font-bold tabular-nums ${muted ? "text-muted" : "text-ink"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs leading-snug text-muted">{hint}</p> : null}
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
      ? (failures[0]?.error ?? "Failed to load these figures")
      : failures.length > 0
        ? `Some sections failed to load (${failures.length} of ${results.length}). Showing what loaded.`
        : null;
  return {
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

type BundleState = ReturnType<typeof readBundle>;

/** Loads the secondary-tab figures on demand, showing the session's last copy first. */
function useDashboardBundle() {
  const [data, setData] = useState<BundleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      try {
        const cached = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
        if (cached && !cancelled) setData((prev) => prev ?? readBundle(JSON.parse(cached) as DashboardBundle));
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
          setError(j && "error" in j && typeof j.error === "string" ? j.error : "Failed to load these figures");
          return;
        }
        const next = readBundle(j as DashboardBundle);
        setData(next);
        setError(next.error);
        try {
          sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(j));
        } catch {
          /* storage full or disabled */
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load these figures");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [requested, attempt]);

  const request = useCallback(() => setRequested(true), []);
  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);
  return { data, error, request, retry };
}

export function DashboardView({
  overview,
  initialTab,
}: {
  overview: DashboardOverview;
  initialTab: DashboardTab;
}) {
  const [tab, setTab] = useState<DashboardTab>(initialTab);
  const bundle = useDashboardBundle();
  const { openMetric } = useHandicaper();
  const { request } = bundle;

  useEffect(() => {
    if (tab !== "overview") request();
  }, [tab, request]);

  const selectTab = (next: DashboardTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = DASHBOARD_TABS[(index + delta + DASHBOARD_TABS.length) % DASHBOARD_TABS.length];
    selectTab(next.id);
    document.getElementById(`dash-tab-${next.id}`)?.focus();
  };

  const k = overview.kpis;
  const availableHint = [
    `${k.availableByType.hardware} computers`,
    `${k.availableByType.usb_hid_msr} card readers`,
    k.availableByType.other ? `${k.availableByType.other} other` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Operations overview"
        description="Your hardware at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory" className="btn-secondary">
              Open board
            </Link>
            <Link href="/assets" className="btn-secondary">
              All assets
            </Link>
            <Link href="/reports" className="btn-secondary">
              Reports
            </Link>
          </div>
        }
      />

      <section aria-label="Key figures">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile label="Total assets" value={k.total} hint="Every stage" href="/assets" metricKey="totalRegistered" onExplain={openMetric} />
          <KpiTile label="Deployed" value={k.deployed} hint="In use at clubs" href="/assets?status=deployed" metricKey="deployed" onExplain={openMetric} />
          <KpiTile
            label="Available"
            value={k.available}
            hint={availableHint}
            href={`/assets?status=${encodeURIComponent(AVAILABLE_STATUS_PARAM)}`}
            metricKey="available"
            onExplain={openMetric}
          />
          <KpiTile label="In repair" value={k.inRepair} hint="With a technician" href="/assets?status=repair" metricKey="inRepair" onExplain={openMetric} />
          <KpiTile label="Written off" value={k.writtenOff} hint="No longer in use" href="/assets?status=written_off" metricKey="writtenOff" onExplain={openMetric} />
        </div>
      </section>

      <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {DASHBOARD_TABS.map((t, i) => (
          <button
            key={t.id}
            id={`dash-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`dash-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => selectTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            onPointerEnter={t.id === "overview" ? undefined : request}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              tab === t.id ? "border-hna-green-strong text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`dash-panel-${tab}`} role="tabpanel" aria-labelledby={`dash-tab-${tab}`} className="space-y-6">
        {tab === "overview" ? (
          <OverviewTab overview={overview} />
        ) : !bundle.data ? (
          bundle.error ? (
            <LoadError message={bundle.error} onRetry={bundle.retry} />
          ) : (
            <TabSkeleton />
          )
        ) : (
          <>
            {bundle.error ? <LoadError message={bundle.error} onRetry={bundle.retry} /> : null}
            {tab === "fleet" ? <FleetTab overview={overview} data={bundle.data} /> : null}
            {tab === "activity" ? <ActivityTab data={bundle.data} /> : null}
            {tab === "sync" ? <SyncTab data={bundle.data} /> : null}
          </>
        )}
      </div>
    </main>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
      {message}{" "}
      <button type="button" className="font-semibold underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" role="status" aria-label="Loading">
      <SkeletonBlock className="h-64 w-full" />
      <SkeletonBlock className="h-64 w-full" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

function OverviewTab({ overview }: { overview: DashboardOverview }) {
  return (
    <>
      <StageBar stages={overview.stages} total={overview.total} />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="section-card min-w-0 p-6" aria-labelledby="mix-heading">
          <h2 id="mix-heading" className="font-heading text-lg font-bold text-ink">
            Manufacturer mix
          </h2>
          <p className="mt-1 text-sm text-muted">All {overview.total} units. Mecer and Mustek count as Mecer.</p>
          <div className="mt-2">
            <ManufacturerDonut manufacturers={overview.manufacturers} total={overview.total} />
          </div>
        </section>
        <section className="section-card min-w-0 p-6" aria-labelledby="models-heading">
          <h2 id="models-heading" className="font-heading text-lg font-bold text-ink">
            Most common models
          </h2>
          <p className="mt-1 text-sm text-muted">All stages, by number of units.</p>
          <div className="mt-4">
            <TopModels skus={overview.topSkus} distinctModels={overview.distinctModels} />
          </div>
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DataQualityCard items={overview.dataQuality} />
        <div className="grid content-start gap-3">
          <CoverageFigure
            label="Average age"
            stat={overview.averageAgeYears}
            format={(v) => `${round1(v)} yrs`}
            help="Years since the purchase date, for units still in use. Only units with a purchase date count."
          />
          <CoverageFigure
            label="Warranty ending in 90 days"
            stat={overview.warrantyExpiring90Days}
            format={(v) => String(v)}
            help="Units still in use whose warranty end date falls in the next 90 days. Only units with a warranty date count."
          />
        </div>
      </div>
    </>
  );
}

function FleetTab({ overview, data }: { overview: DashboardOverview; data: BundleState }) {
  const { fleet, summary } = data;
  const lowPurchase = !fleet || fleet.totalOperational === 0 || fleet.withPurchaseDate / fleet.totalOperational < 0.5;
  const lowWarranty = !fleet || fleet.totalOperational === 0 || fleet.withWarrantyEnd / fleet.totalOperational < 0.5;

  return (
    <>
      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Fleet insights</h2>
        <p className="mt-1 text-sm text-muted">Units still in use; written-off units are left out.</p>
        {fleet && fleet.totalOperational > 0 ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Units in use" value={fleet.totalOperational} hint="Excludes written off" />
              <Stat label="Brands" value={fleet.distinctManufacturers} />
              <Stat label="Models" value={fleet.distinctModels} />
              <Stat
                label="Top brand share"
                value={`${round1(fleet.topManufacturerShare)}%`}
                hint={fleet.byManufacturer[0]?.name}
                help="Share of units in use made by the most common brand."
              />
              <Stat
                label="Top 3 models share"
                value={`${round1(fleet.topThreeModelsShare)}%`}
                help="Share of units in use that are one of the three most common models."
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Purchase date recorded" value={`${round1(fleet.purchaseDateCoveragePct)}%`} hint={`${fleet.withPurchaseDate} of ${fleet.totalOperational} units`} />
              <Stat label="Warranty date recorded" value={`${round1(fleet.warrantyEndCoveragePct)}%`} hint={`${fleet.withWarrantyEnd} of ${fleet.totalOperational} units`} />
              <CoverageFigure label="Average age" stat={overview.averageAgeYears} format={(v) => `${round1(v)} yrs`} />
              <CoverageFigure label="Warranty ending in 90 days" stat={overview.warrantyExpiring90Days} format={(v) => String(v)} />
            </div>
            <p className="mt-3 text-xs text-muted">
              Added to this register in the last 24 months: <strong>{round1(fleet.registeredLast24MonthsPct)}%</strong> of units in use.
            </p>
          </>
        ) : (
          <p className="mt-6 text-sm text-muted">{fleet ? "No units in use to analyse." : "Could not load fleet figures."}</p>
        )}
      </section>

      {fleet && fleet.totalOperational > 0 ? (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="section-card p-6">
              <h3 className="font-heading text-sm font-bold text-ink">Added to the register by year</h3>
              <p className="mt-1 text-xs text-muted">When units were added to this system — shows bulk rollouts.</p>
              <div className="mt-4 h-64">
                {fleet.byRegistrationYear.length ? (
                  <RegistrationYearChart data={fleet.byRegistrationYear.map((y) => ({ year: y.year, count: y.count }))} />
                ) : null}
              </div>
            </section>
            <section className={`section-card p-6 ${lowPurchase ? "opacity-80" : ""}`}>
              <h3 className="font-heading text-sm font-bold text-ink">Bought by year</h3>
              <p className={`mt-1 text-xs ${lowPurchase ? "font-medium text-amber-800" : "text-muted"}`}>
                {lowPurchase
                  ? `Based on ${fleet.withPurchaseDate} of ${fleet.totalOperational} units — most have no purchase date yet.`
                  : "Units with a purchase date."}
              </p>
              <div className="mt-4 h-64">
                {fleet.byPurchaseYear.length ? (
                  <RegistrationYearChart datasetLabel="Units by purchase date" data={fleet.byPurchaseYear.map((y) => ({ year: y.year, count: y.count }))} />
                ) : (
                  <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
                    No purchase dates recorded yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className={`section-card p-6 ${lowWarranty ? "opacity-80" : ""}`}>
              <h3 className="font-heading text-sm font-bold text-ink">Warranty</h3>
              <p className={`mt-1 text-xs ${lowWarranty ? "font-medium text-amber-800" : "text-muted"}`}>
                {lowWarranty
                  ? `Based on ${fleet.withWarrantyEnd} of ${fleet.totalOperational} units — most have no warranty date yet.`
                  : "From the warranty end date on each unit in use."}
              </p>
              <dl className={`mt-4 space-y-2 text-sm ${lowWarranty ? "text-muted" : "text-ink"}`}>
                <div className="flex justify-between gap-4">
                  <dt>Under warranty</dt>
                  <dd className="font-mono font-semibold tabular-nums">{fleet.warrantyActiveKnown}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Ending within 90 days</dt>
                  <dd className="font-mono font-semibold tabular-nums">{fleet.warrantyExpiring90Days}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Out of warranty</dt>
                  <dd className="font-mono font-semibold tabular-nums">{fleet.warrantyExpired}</dd>
                </div>
              </dl>
            </section>
            <section className="section-card p-6">
              <h3 className="font-heading text-sm font-bold text-ink">Notes</h3>
              <p className="mt-1 text-xs text-muted">Generated from the figures above — check them against what you know.</p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink">
                {fleet.insights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="section-card overflow-hidden">
            <h3 className="px-6 pt-6 font-heading text-sm font-bold text-ink">Models in use</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-black/[0.02] text-left">
                    <th className="px-6 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium tabular-nums">Units</th>
                    <th className="px-3 py-2 font-medium tabular-nums">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.byModel.slice(0, 15).map((m, idx) => (
                    <tr key={`${idx}-${m.label.slice(0, 24)}`} className="border-b border-line last:border-b-0">
                      <td className="max-w-md px-6 py-2">{m.label}</td>
                      <td className="px-3 py-2 tabular-nums">{m.count}</td>
                      <td className="px-3 py-2 tabular-nums text-ink">{m.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="section-card p-6">
          <h2 className="font-heading text-lg font-bold text-ink">By category</h2>
          <p className="mt-1 text-sm text-muted">Units per category, all stages.</p>
          <div className="mt-4 h-72">
            {summary?.byCategory?.length ? (
              <CategoryBarChart data={summary.byCategory} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No categories recorded.</p>
            )}
          </div>
        </section>
        <section className="section-card p-6">
          <h2 className="font-heading text-lg font-bold text-ink">How units were added</h2>
          <p className="mt-1 text-sm text-muted">Added by hand vs imported from Zoho Assist.</p>
          <div className="mx-auto mt-4 h-72 max-w-sm">
            {summary?.byDataSource?.length ? (
              <DataSourceDonutChart data={summary.byDataSource} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No data.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function ActivityTab({ data }: { data: BundleState }) {
  const { repairs, refurbished, summary, writeoffs } = data;
  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="section-card p-6">
          <h2 className="font-heading text-lg font-bold text-ink">Repairs</h2>
          <p className="mt-1 text-sm text-muted">Repair tickets by state, from pending to completed.</p>
          <div className="mt-4 h-72">
            {repairs?.pipeline?.length ? (
              <RepairsBarChart data={repairs.pipeline} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No repair tickets yet.</p>
            )}
          </div>
        </section>
        <section className="section-card p-6">
          <h2 className="font-heading text-lg font-bold text-ink">Refurbished over time</h2>
          <p className="mt-1 text-sm text-muted">Running total of refurbished units, by last update.</p>
          <div className="mt-4 h-72">
            {refurbished?.assets?.length ? (
              <RefurbishedLineChart data={refurbished.assets} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No refurbished units.</p>
            )}
          </div>
        </section>
      </div>

      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Recently updated</h2>
        {summary?.recentAssets?.length ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left">
                  <th className="px-3 py-2 font-medium">Asset</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Added by</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentAssets.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/assets?asset=${encodeURIComponent(a.id)}`} className="hover:underline">
                        {a.assetName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink">{a.status.label}</td>
                    <td className="px-3 py-2 text-muted">{a.dataSource === "zoho_assist" ? "Zoho Assist import" : "Manually"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDateTime(a.dateUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-8 text-center text-muted">No recent updates.</p>
        )}
      </section>

      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Write-offs</h2>
        <p className="mt-1 text-sm text-muted">Reasons, and the latest written-off units.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="mx-auto max-w-xs lg:mx-0">
            {writeoffs?.byReason?.length ? (
              <WriteoffsDonutChart data={writeoffs.byReason} />
            ) : (
              <p className="py-8 text-center text-muted">No write-offs by reason.</p>
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
                {writeoffs.assets.length > 10 && <p className="mt-2 text-sm text-muted">+{writeoffs.assets.length - 10} more</p>}
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
    </>
  );
}

function SyncTab({ data }: { data: BundleState }) {
  const { assetGeo, xeroHealth } = data;
  const geoRegionBarData = useMemo(
    () =>
      (assetGeo?.byRegion ?? []).slice(0, 16).map((row) => ({
        category: row.label.length > 56 ? `${row.label.slice(0, 54)}…` : row.label,
        count: row.count,
      })),
    [assetGeo]
  );
  const geoCountryBarData = useMemo(
    () => (assetGeo?.byCountry ?? []).slice(0, 12).map((row) => ({ category: row.countryCode, count: row.count })),
    [assetGeo]
  );
  const lowGeo = assetGeo ? assetGeo.geoCoveragePct < 50 : false;

  return (
    <>
      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Where units connect from</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">
          Approximate location worked out from each unit&apos;s internet address, refreshed on Zoho Assist import and by the weekly sync.
          VPNs and mobile networks can make this inaccurate.
        </p>
        {assetGeo && assetGeo.totalOperational > 0 ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="With an internet address" value={`${round1(assetGeo.publicIpCoveragePct)}%`} hint={`${assetGeo.withPublicIp} of ${assetGeo.totalOperational} units in use`} />
              <Stat label="With a location" value={`${round1(assetGeo.geoCoveragePct)}%`} hint={`${assetGeo.withGeo} of ${assetGeo.totalOperational} units in use`} />
              <Stat label="Countries" value={assetGeo.byCountry.length} muted={lowGeo} hint={lowGeo ? `Based on ${assetGeo.withGeo} units` : undefined} />
              <Stat label="Regions" value={assetGeo.byRegion.length} muted={lowGeo} hint={lowGeo ? `Based on ${assetGeo.withGeo} units` : "Province or state"} />
            </div>
            <p className="mt-3 text-xs text-muted">{assetGeo.note}</p>
            <div className="mt-8 grid gap-8 xl:grid-cols-2">
              <div>
                <h3 className="font-heading text-sm font-bold text-ink">By region or province</h3>
                <div className="mt-4 h-72">
                  {geoRegionBarData.length ? (
                    <CategoryBarChart data={geoRegionBarData} />
                  ) : (
                    <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
                      No regional data yet — sync from Zoho Assist to fill this in.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-ink">By country</h3>
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
          <p className="mt-6 text-sm text-muted">{assetGeo ? "No units in use." : "Could not load location figures."}</p>
        )}
      </section>

      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Xero sync</h2>
        <p className="mt-1 text-sm text-muted">Connection status and sync queue by state and type.</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className={`h-3 w-3 rounded-full ${xeroHealth?.configured ? "bg-brand" : "bg-amber-500"}`} />
          <span className="text-sm text-ink">
            {xeroHealth?.configured ? "Xero is connected" : "Xero is not set up — set XERO_CLIENT_ID and XERO_CLIENT_SECRET"}
          </span>
        </div>
        {xeroHealth?.summary && Object.keys(xeroHealth.summary).length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-line bg-black/[0.03] text-left">
                  <th className="px-4 py-3 font-medium">Sync status</th>
                  <th className="px-4 py-3 font-medium tabular-nums">Fixed asset</th>
                  <th className="px-4 py-3 font-medium tabular-nums">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(xeroHealth.summary).map(([status, row]) => (
                  <tr key={status} className="border-b border-line">
                    <td className="px-4 py-2 capitalize">{status}</td>
                    <td className="px-4 py-2 tabular-nums text-ink">{row.fixed_asset}</td>
                    <td className="px-4 py-2 tabular-nums text-ink">{row.inventory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">Nothing has been synced to Xero yet.</p>
        )}
        {xeroHealth?.recent && xeroHealth.recent.length > 0 ? (
          <div className="mt-6">
            <h3 className="font-heading text-xs font-bold text-muted">Recent sync attempts</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {xeroHealth.recent.slice(0, 8).map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                  <span className="font-medium text-ink">{r.asset.assetName}</span>
                  <span className="text-muted">
                    {r.xeroType.replace("_", " ")} · <span className="capitalize">{r.syncStatus}</span>
                  </span>
                  <span className="w-full text-xs text-muted sm:w-auto">{formatDateTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}
