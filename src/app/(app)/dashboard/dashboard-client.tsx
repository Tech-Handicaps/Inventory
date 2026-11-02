"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SkeletonBlock } from "@/components/Skeleton";
import { useHandicaper } from "@/components/HandicaperProvider";
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
import type { DashboardActivity, DashboardSync } from "@/lib/reports/dashboard-tab-data";
import { DASHBOARD_TABS, type DashboardTab } from "@/lib/reports/dashboard-tabs";

/** Charts load with their tab, so the Overview never waits for the charting library. */
const chartLoading = () => <SkeletonBlock className="h-full w-full" />;
const CategoryBarChart = dynamic(() => import("@/components/charts/CategoryBarChart").then((m) => m.CategoryBarChart), {
  ssr: false,
  loading: chartLoading,
});
const DataSourceDonutChart = dynamic(
  () => import("@/components/charts/DataSourceDonutChart").then((m) => m.DataSourceDonutChart),
  { ssr: false, loading: chartLoading }
);
const RegistrationYearChart = dynamic(
  () => import("@/components/charts/RegistrationYearChart").then((m) => m.RegistrationYearChart),
  { ssr: false, loading: chartLoading }
);
const RefurbishedLineChart = dynamic(
  () => import("@/components/charts/RefurbishedLineChart").then((m) => m.RefurbishedLineChart),
  { ssr: false, loading: chartLoading }
);
const RepairsBarChart = dynamic(() => import("@/components/charts/RepairsBarChart").then((m) => m.RepairsBarChart), {
  ssr: false,
  loading: chartLoading,
});
const WriteoffsDonutChart = dynamic(
  () => import("@/components/charts/WriteoffsDonutChart").then((m) => m.WriteoffsDonutChart),
  { ssr: false, loading: chartLoading }
);

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : 0);

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

type TabData = { activity: DashboardActivity; sync: DashboardSync };
type LoadState<T> = { data: T | null; error: string | null };

/** Fetches one tab's figures the first time that tab is wanted; each tab loads on its own. */
function useTabData() {
  const [state, setState] = useState<{ [K in keyof TabData]?: LoadState<TabData[K]> }>({});
  const [wanted, setWanted] = useState<Set<keyof TabData>>(() => new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controllers: AbortController[] = [];
    for (const tab of wanted) {
      if (state[tab]?.data) continue;
      const controller = new AbortController();
      controllers.push(controller);
      void fetch(`/api/reports/dashboard-tab?tab=${tab}`, { signal: controller.signal })
        .then(async (r) => {
          const j = await r.json().catch(() => null);
          if (!r.ok || !j) throw new Error(j?.error ?? "Failed to load these figures");
          setState((s) => ({ ...s, [tab]: { data: j, error: null } }));
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setState((s) => ({ ...s, [tab]: { data: null, error: e instanceof Error ? e.message : "Failed to load" } }));
        });
    }
    return () => controllers.forEach((c) => c.abort());
    // `state` is read only to skip tabs that already loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, attempt]);

  const want = useCallback((tab: keyof TabData) => {
    setWanted((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, []);
  const retry = useCallback((tab: keyof TabData) => {
    setState((s) => ({ ...s, [tab]: undefined }));
    setAttempt((n) => n + 1);
  }, []);
  return { state, want, retry };
}

export function DashboardView({
  overview,
  initialTab,
}: {
  overview: DashboardOverview;
  initialTab: DashboardTab;
}) {
  const [tab, setTab] = useState<DashboardTab>(initialTab);
  const tabs = useTabData();
  const { openMetric } = useHandicaper();
  const { want } = tabs;

  useEffect(() => {
    if (tab === "activity" || tab === "sync") want(tab);
  }, [tab, want]);

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
            onPointerEnter={t.id === "activity" || t.id === "sync" ? () => want(t.id as "activity" | "sync") : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              tab === t.id ? "border-hna-green-strong text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`dash-panel-${tab}`} role="tabpanel" aria-labelledby={`dash-tab-${tab}`} className="space-y-6">
        {tab === "overview" ? <OverviewTab overview={overview} /> : null}
        {tab === "fleet" ? <FleetTab overview={overview} /> : null}
        {tab === "activity" ? (
          <Loaded state={tabs.state.activity} onRetry={() => tabs.retry("activity")}>
            {(data) => <ActivityTab data={data} />}
          </Loaded>
        ) : null}
        {tab === "sync" ? (
          <Loaded state={tabs.state.sync} onRetry={() => tabs.retry("sync")}>
            {(data) => <SyncTab data={data} />}
          </Loaded>
        ) : null}
      </div>
    </main>
  );
}

function Loaded<T>({
  state,
  onRetry,
  children,
}: {
  state: LoadState<T> | undefined;
  onRetry: () => void;
  children: (data: T) => React.ReactNode;
}) {
  if (state?.data) return <>{children(state.data)}</>;
  if (state?.error) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
        {state.error}{" "}
        <button type="button" className="font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2" role="status" aria-label="Loading">
      <SkeletonBlock className="h-64 w-full" />
      <SkeletonBlock className="h-64 w-full" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** "133 units in use (3 written off left out)" — says why the base is not the total. */
function inUseBase(overview: DashboardOverview) {
  const off = overview.fleet.writtenOff;
  return off ? `${overview.fleet.inUse} units in use (the ${off} written off are left out)` : `${overview.fleet.inUse} units`;
}

function OverviewTab({ overview }: { overview: DashboardOverview }) {
  const base = inUseBase(overview);
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
          <p className="mt-1 text-sm text-muted">All {overview.total} units, by number of units.</p>
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
            unitsLabel="units in use"
            help={`Years since the purchase date, across the ${base}. Only units with a purchase date count.`}
          />
          <CoverageFigure
            label="Warranty ending in 90 days"
            stat={overview.warrantyExpiring90Days}
            format={(v) => String(v)}
            unitsLabel="units in use"
            help={`Units whose warranty ends in the next 90 days, across the ${base}. Only units with a warranty date count.`}
          />
        </div>
      </div>
    </>
  );
}

function FleetTab({ overview }: { overview: DashboardOverview }) {
  const f = overview.fleet;
  const lowPurchase = f.purchaseDates.of === 0 || f.purchaseDates.have / f.purchaseDates.of < 0.5;
  const lowWarranty = f.warrantyDates.of === 0 || f.warrantyDates.have / f.warrantyDates.of < 0.5;

  return (
    <>
      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Fleet insights</h2>
        <p className="mt-1 text-sm text-muted">
          Based on the {inUseBase(overview)}. Brands and models are grouped the same way as on Overview.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Units in use" value={f.inUse} hint={`${overview.total} total − ${f.writtenOff} written off`} />
          <Stat label="Brands" value={f.brandsInUse} hint="Among units in use" />
          <Stat label="Models" value={overview.distinctModels} hint="Same list as Overview" />
          <Stat
            label="Top brand share"
            value={`${f.topBrand?.share ?? 0}%`}
            hint={f.topBrand?.name}
            help="Share of units in use made by the most common brand."
          />
          <Stat
            label="Top 3 models share"
            value={`${f.topThreeModelsShare}%`}
            help="Share of units in use that are one of the three most common models."
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Purchase date recorded"
            value={`${pct(f.purchaseDates.have, f.purchaseDates.of)}%`}
            hint={`${f.purchaseDates.have} of ${f.purchaseDates.of} units in use`}
          />
          <Stat
            label="Warranty date recorded"
            value={`${pct(f.warrantyDates.have, f.warrantyDates.of)}%`}
            hint={`${f.warrantyDates.have} of ${f.warrantyDates.of} units in use`}
          />
          <CoverageFigure label="Average age" stat={overview.averageAgeYears} format={(v) => `${round1(v)} yrs`} unitsLabel="units in use" />
          <CoverageFigure
            label="Warranty ending in 90 days"
            stat={overview.warrantyExpiring90Days}
            format={(v) => String(v)}
            unitsLabel="units in use"
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Added to this register in the last 24 months: <strong>{f.addedLast24MonthsPct}%</strong> of units in use.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="section-card min-w-0 p-6">
          <h3 className="font-heading text-sm font-bold text-ink">Added to the register by year</h3>
          <p className="mt-1 text-xs text-muted">When units in use were added to this system — shows bulk rollouts.</p>
          <div className="mt-4 h-64">
            {f.byRegistrationYear.length ? <RegistrationYearChart data={f.byRegistrationYear} /> : null}
          </div>
        </section>
        <section className={`section-card min-w-0 p-6 ${lowPurchase ? "opacity-80" : ""}`}>
          <h3 className="font-heading text-sm font-bold text-ink">Bought by year</h3>
          <p className={`mt-1 text-xs ${lowPurchase ? "font-medium text-amber-800" : "text-muted"}`}>
            {lowPurchase
              ? `Based on ${f.purchaseDates.have} of ${f.purchaseDates.of} units in use — most have no purchase date yet.`
              : "Units in use with a purchase date."}
          </p>
          <div className="mt-4 h-64">
            {f.byPurchaseYear.length ? (
              <RegistrationYearChart datasetLabel="Units by purchase date" data={f.byPurchaseYear} />
            ) : (
              <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
                No purchase dates recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className={`section-card p-6 ${lowWarranty ? "opacity-80" : ""}`}>
        <h3 className="font-heading text-sm font-bold text-ink">Warranty</h3>
        <p className={`mt-1 text-xs ${lowWarranty ? "font-medium text-amber-800" : "text-muted"}`}>
          {lowWarranty
            ? `Based on ${f.warrantyDates.have} of ${f.warrantyDates.of} units in use — most have no warranty date yet.`
            : "From the warranty end date on each unit in use."}
        </p>
        <dl className={`mt-4 grid gap-2 text-sm sm:grid-cols-3 ${lowWarranty ? "text-muted" : "text-ink"}`}>
          <div className="flex justify-between gap-4 rounded-md border border-line px-3 py-2">
            <dt>Under warranty</dt>
            <dd className="font-mono font-semibold tabular-nums">{f.warranty.active}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-md border border-line px-3 py-2">
            <dt>Ending within 90 days</dt>
            <dd className="font-mono font-semibold tabular-nums">{f.warranty.expiring90}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-md border border-line px-3 py-2">
            <dt>Out of warranty</dt>
            <dd className="font-mono font-semibold tabular-nums">{f.warranty.expired}</dd>
          </div>
        </dl>
      </section>

      <section className="section-card overflow-hidden">
        <div className="px-6 pt-6">
          <h3 className="font-heading text-sm font-bold text-ink">Models</h3>
          <p className="mt-1 text-xs text-muted">
            The same {overview.distinctModels} models as Overview. “In use” leaves out written-off units; “Total” includes them.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-line bg-black/[0.02] text-left">
                <th className="px-6 py-2 font-medium">Model</th>
                <th className="px-3 py-2 text-right font-medium">In use</th>
                <th className="px-3 py-2 text-right font-medium">Share of in use</th>
                <th className="px-3 py-2 text-right font-medium">Written off</th>
                <th className="px-6 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {f.models.map((m) => (
                <tr key={`${m.brand}-${m.model}`} className="border-b border-line last:border-b-0">
                  <td className="max-w-md px-6 py-2">
                    <Link prefetch={false} href={`/assets?q=${encodeURIComponent(m.model)}`} className="hover:underline">
                      {m.model.toLowerCase().startsWith(m.brand.toLowerCase()) ? null : <span className="text-muted">{m.brand} </span>}
                      {m.model}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.inUse}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{pct(m.inUse, f.inUse)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{m.writtenOff || "—"}</td>
                  <td className="px-6 py-2 text-right font-semibold tabular-nums">{m.total}</td>
                </tr>
              ))}
              {f.noModel.inUse + f.noModel.writtenOff > 0 ? (
                <tr className="border-t border-line text-muted">
                  <td className="px-6 py-2 italic">No model recorded</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.noModel.inUse}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(f.noModel.inUse, f.inUse)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.noModel.writtenOff || "—"}</td>
                  <td className="px-6 py-2 text-right tabular-nums">{f.noModel.inUse + f.noModel.writtenOff}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="section-card min-w-0 p-6">
          <h2 className="font-heading text-lg font-bold text-ink">By category</h2>
          <p className="mt-1 text-sm text-muted">All {overview.total} units.</p>
          <div className="mt-4 h-72">
            {overview.categories.length ? (
              <CategoryBarChart data={overview.categories} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No categories recorded.</p>
            )}
          </div>
        </section>
        <section className="section-card min-w-0 p-6">
          <h2 className="font-heading text-lg font-bold text-ink">How units were added</h2>
          <p className="mt-1 text-sm text-muted">All {overview.total} units: added by hand vs imported from Zoho Assist.</p>
          <div className="mx-auto mt-4 h-72 max-w-sm">
            {overview.dataSources.length ? (
              <DataSourceDonutChart data={overview.dataSources} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No data.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function ActivityTab({ data }: { data: DashboardActivity }) {
  const { repairs, refurbished, recent, writeoffs } = data;
  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="section-card min-w-0 p-6">
          <h2 className="font-heading text-lg font-bold text-ink">Repairs</h2>
          <p className="mt-1 text-sm text-muted">Repair tickets by state, from pending to completed.</p>
          <div className="mt-4 h-72">
            {repairs.length ? (
              <RepairsBarChart data={repairs} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No repair tickets yet.</p>
            )}
          </div>
        </section>
        <section className="section-card min-w-0 p-6">
          <h2 className="font-heading text-lg font-bold text-ink">Refurbished over time</h2>
          <p className="mt-1 text-sm text-muted">Running total of refurbished units, by last update.</p>
          <div className="mt-4 h-72">
            {refurbished.length ? (
              <RefurbishedLineChart data={refurbished} />
            ) : (
              <p className="flex h-full items-center justify-center text-muted">No refurbished units.</p>
            )}
          </div>
        </section>
      </div>

      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Recently updated</h2>
        {recent.length ? (
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
                {recent.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2 font-medium">
                      <Link prefetch={false} href={`/assets?asset=${encodeURIComponent(a.id)}`} className="hover:underline">
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
          <div className="mx-auto w-full max-w-xs lg:mx-0">
            {writeoffs.byReason.length ? (
              <WriteoffsDonutChart data={writeoffs.byReason} />
            ) : (
              <p className="py-8 text-center text-muted">No write-offs by reason.</p>
            )}
          </div>
          <div>
            {writeoffs.assets.length ? (
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
        <p className="mt-4 text-sm text-muted">
          Total write-offs: <strong>{writeoffs.total}</strong>
        </p>
      </section>
    </>
  );
}

function SyncTab({ data }: { data: DashboardSync }) {
  const { geo, xero } = data;
  const regions = geo.byRegion.slice(0, 16).map((row) => ({
    category: row.label.length > 56 ? `${row.label.slice(0, 54)}…` : row.label,
    count: row.count,
  }));
  const countries = geo.byCountry.slice(0, 12).map((row) => ({ category: row.countryCode, count: row.count }));
  const lowGeo = geo.geoCoveragePct < 50;

  return (
    <>
      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Where units connect from</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">
          Approximate location worked out from each unit&apos;s internet address, refreshed on Zoho Assist import and by the weekly sync.
          VPNs and mobile networks can make this inaccurate.
        </p>
        {geo.totalOperational > 0 ? (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="With an internet address" value={`${geo.publicIpCoveragePct}%`} hint={`${geo.withPublicIp} of ${geo.totalOperational} units in use`} />
              <Stat label="With a location" value={`${geo.geoCoveragePct}%`} hint={`${geo.withGeo} of ${geo.totalOperational} units in use`} />
              <Stat label="Countries" value={geo.byCountry.length} muted={lowGeo} hint={lowGeo ? `Based on ${geo.withGeo} units` : undefined} />
              <Stat label="Regions" value={geo.byRegion.length} muted={lowGeo} hint={lowGeo ? `Based on ${geo.withGeo} units` : "Province or state"} />
            </div>
            <div className="mt-8 grid gap-8 xl:grid-cols-2">
              <div className="min-w-0">
                <h3 className="font-heading text-sm font-bold text-ink">By region or province</h3>
                <div className="mt-4 h-72">
                  {regions.length ? (
                    <CategoryBarChart data={regions} />
                  ) : (
                    <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
                      No regional data yet — sync from Zoho Assist to fill this in.
                    </p>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-sm font-bold text-ink">By country</h3>
                <div className="mt-4 h-72">
                  {countries.length ? (
                    <CategoryBarChart data={countries} />
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
          <p className="mt-6 text-sm text-muted">No units in use.</p>
        )}
      </section>

      <section className="section-card p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Xero sync</h2>
        <p className="mt-1 text-sm text-muted">Connection status and sync queue by state and type.</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className={`h-3 w-3 rounded-full ${xero.configured ? "bg-brand" : "bg-amber-500"}`} />
          <span className="text-sm text-ink">
            {xero.configured ? "Xero is connected" : "Xero is not set up — set XERO_CLIENT_ID and XERO_CLIENT_SECRET"}
          </span>
        </div>
        {Object.keys(xero.summary).length > 0 ? (
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
                {Object.entries(xero.summary).map(([status, row]) => (
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
        {xero.recent.length > 0 ? (
          <div className="mt-6">
            <h3 className="font-heading text-xs font-bold text-muted">Recent sync attempts</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {xero.recent.map((r) => (
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
