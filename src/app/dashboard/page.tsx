"use client";

import { useEffect, useState } from "react";
import { StockPieChart } from "@/components/charts/StockPieChart";
import { RepairsBarChart } from "@/components/charts/RepairsBarChart";
import { RefurbishedLineChart } from "@/components/charts/RefurbishedLineChart";
import { WriteoffsDonutChart } from "@/components/charts/WriteoffsDonutChart";
import { InventoryHeader } from "@/components/InventoryHeader";

type StockData = { stock: { status: string; count: number }[]; total: number };
type RepairsData = {
  pipeline: { status: string; count: number }[];
  repairs: { asset: { assetName: string } }[];
};
type RefurbishedData = { assets: { assetName: string; dateUpdated: string }[] };
type WriteoffsData = {
  assets: { assetName: string; reason: string | null }[];
  byReason: { reason: string; count: number }[];
  total: number;
};
type XeroHealth = {
  configured: boolean;
  summary: Record<string, { fixed_asset: number; inventory: number }>;
};

export default function DashboardPage() {
  const [stock, setStock] = useState<StockData | null>(null);
  const [repairs, setRepairs] = useState<RepairsData | null>(null);
  const [refurbished, setRefurbished] = useState<RefurbishedData | null>(null);
  const [writeoffs, setWriteoffs] = useState<WriteoffsData | null>(null);
  const [xeroHealth, setXeroHealth] = useState<XeroHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/reports/stock").then((r) => r.json()),
      fetch("/api/reports/repairs").then((r) => r.json()),
      fetch("/api/reports/refurbished").then((r) => r.json()),
      fetch("/api/reports/writeoffs").then((r) => r.json()),
      fetch("/api/xero/health").then((r) => r.json()),
    ])
      .then(([s, r, ref, w, x]) => {
        setStock(s);
        setRepairs(r);
        setRefurbished(ref);
        setWriteoffs(w);
        setXeroHealth(x);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
        {/* Stock Overview - Pie Chart */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Stock overview
          </h2>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <div className="mx-auto mt-6 max-w-sm">
            {stock?.stock?.length ? (
              <StockPieChart data={stock.stock} />
            ) : (
              <p className="py-8 text-center text-black/50">
                No stock data. Run seed and add assets.
              </p>
            )}
          </div>
          {stock && (
            <p className="mt-2 text-center text-sm text-black/55">
              Total: {stock.total} assets
            </p>
          )}
        </section>

        {/* Repair Pipeline - Bar Chart */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Repair pipeline
          </h2>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <div className="mt-6 h-64">
            {repairs?.pipeline?.length ? (
              <RepairsBarChart data={repairs.pipeline} />
            ) : (
              <p className="py-8 text-center text-black/50">
                No repairs data.
              </p>
            )}
          </div>
        </section>

        {/* Refurbished Assets - Line Chart */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Refurbished assets
          </h2>
          <p className="mt-1 text-sm text-black/55">
            Redistribution readiness
          </p>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <div className="mt-6 h-64">
            {refurbished?.assets?.length ? (
              <RefurbishedLineChart data={refurbished.assets} />
            ) : (
              <p className="py-8 text-center text-black/50">
                No refurbished assets.
              </p>
            )}
          </div>
        </section>

        {/* Write-Offs - Donut + Table */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Write-offs summary
          </h2>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="mx-auto max-w-xs">
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
                        <tr key={a.assetName} className="border-b border-black/5">
                          <td className="py-2">{a.assetName}</td>
                          <td className="py-2">{a.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {writeoffs.assets.length > 10 && (
                    <p className="mt-2 text-black/55">
                      +{writeoffs.assets.length - 10} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-8 text-black/50">No write-offs.</p>
              )}
            </div>
          </div>
          {writeoffs && (
            <p className="mt-2 text-sm text-black/55">
              Total write-offs: {writeoffs.total}
            </p>
          )}
        </section>

        {/* Financial Sync Status - Xero Health */}
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Financial sync (Xero)
          </h2>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <div className="mt-6 flex items-center gap-4">
            <div
              className={`h-3 w-3 rounded-full ${
                xeroHealth?.configured ? "bg-brand" : "bg-amber-500"
              }`}
            />
            <span className="text-sm text-black/80">
              {xeroHealth?.configured
                ? "Xero configured — OAuth2 ready"
                : "Xero not configured — add XERO_CLIENT_ID and XERO_CLIENT_SECRET"}
            </span>
          </div>
          {xeroHealth?.summary && Object.keys(xeroHealth.summary).length > 0 && (
            <pre className="mt-4 overflow-auto rounded bg-brand-muted/50 p-4 text-xs text-black/80">
              {JSON.stringify(xeroHealth.summary, null, 2)}
            </pre>
          )}
        </section>
      </main>
    </div>
  );
}
