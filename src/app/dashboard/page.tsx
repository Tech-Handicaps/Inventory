"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { DataSourceDonutChart } from "@/components/charts/DataSourceDonutChart";
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
    ])
      .then(([s, r, ref, w, sum, x]) => {
        setStock(s);
        setRepairs(r);
        setRefurbished(ref);
        setWriteoffs(w);
        setSummary(sum);
        setXeroHealth(x);
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
