"use client";

import { useEffect, useState } from "react";

type FinancePackMonth = {
  monthKey: string;
  monthEndingLabel: string;
  sentAt: string;
  recipientCount: number;
  newStock: number;
  refurbished: number;
  usable: number;
  deployed: number;
  assessment: number;
  inRepair: number;
  writtenOff: number;
  register: number;
  modelCount: number;
};

function pdfHref(
  monthKey: string,
  kind: "reconcile" | "breakdown" | "month-on-month" | "yearly",
  download = false
) {
  const base = `/api/reports/finance-packs/pdf?month=${encodeURIComponent(monthKey)}&kind=${kind}`;
  return download ? `${base}&download=1` : base;
}

export function FinancePacksSection() {
  const [months, setMonths] = useState<FinancePackMonth[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/finance-packs", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load official finance packs");
        return res.json() as Promise<{ months: FinancePackMonth[] }>;
      })
      .then((body) => {
        if (!cancelled) setMonths(body.months);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load official finance packs");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="finance-packs" className="scroll-mt-6 space-y-4">
      <header className="border-b border-black/10 pb-4">
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
          Official finance packs
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-black/60">
          Each month is the pack that was emailed to finance and then kept.
          The first successful scheduled send wins. A manual test is not kept,
          and a stored month is not replaced.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : months === null ? (
        <p className="text-sm text-black/50">Loading official finance packs…</p>
      ) : months.length === 0 ? (
        <p className="text-sm text-black/60">
          No official finance pack has been kept yet. The next scheduled send
          stores that month.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10">
                <th className="px-4 py-3 font-medium">Report month</th>
                <th className="px-4 py-3 text-right font-medium">New</th>
                <th className="px-4 py-3 text-right font-medium">Refurbished</th>
                <th className="px-4 py-3 text-right font-medium">Usable</th>
                <th className="px-4 py-3 text-right font-medium">Deployed</th>
                <th className="px-4 py-3 text-right font-medium">Assessment</th>
                <th className="px-4 py-3 text-right font-medium">In repairs</th>
                <th className="px-4 py-3 text-right font-medium">Written off</th>
                <th className="px-4 py-3 text-right font-medium">Register</th>
                <th className="px-4 py-3 font-medium">Files</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.monthKey} className="border-b border-black/5">
                  <td className="px-4 py-3">
                    <div className="font-medium">{month.monthEndingLabel}</div>
                    <div className="text-xs text-black/50">
                      {month.modelCount} make and model counts · {month.recipientCount}{" "}
                      sent
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.newStock}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.refurbished}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.usable}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.deployed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.assessment}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.inRepair}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.writtenOff}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.register}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <a
                        href={pdfHref(month.monthKey, "reconcile")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Reconcile
                      </a>
                      <a
                        href={pdfHref(month.monthKey, "breakdown")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Breakdown
                      </a>
                      <a
                        href={pdfHref(month.monthKey, "month-on-month")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Month on month
                      </a>
                      <a
                        href={pdfHref(month.monthKey, "yearly")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Yearly
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
