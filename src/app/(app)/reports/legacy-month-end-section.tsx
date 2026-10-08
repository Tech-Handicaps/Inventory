"use client";

import { useEffect, useState } from "react";
import type { LegacyColumnComposition } from "@/lib/reports/legacy-month-end";
import { StockCompositionBlock } from "./stock-composition-block";

type MonthRow = {
  monthKey: string;
  label: string;
  sourceKind: string;
  sourceFileName: string | null;
  carriedForwardFromMonthKey: string | null;
  newStock: number;
  repairedUsed: number;
  toAssess: number;
  usable: number;
  units: number;
  composition: LegacyColumnComposition[];
};

function pdfHref(monthKey: string, download = false) {
  const base = `/api/reports/legacy-month-end/pdf?month=${encodeURIComponent(monthKey)}`;
  return download ? `${base}&download=1` : base;
}

export function LegacyMonthEndSection() {
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/legacy-month-end", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load prior month-end stock");
        return res.json() as Promise<{ months: MonthRow[] }>;
      })
      .then((body) => {
        if (!cancelled) setMonths(body.months);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load reports");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="prior-months" className="scroll-mt-6 space-y-4">
      <header className="border-b border-black/10 pb-4">
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
          Prior company month-end stock
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-black/60">
          Quantity stock takes from the previous process, October 2025 through
          March 2026. October, November, and December come from the workbooks.
          January, February, and March repeat the December count. April is not
          a copy of December: this system recorded its first asset on 18 April
          2026. These rows are not serialised assets and do not sit on the
          hardware board.
        </p>
      </header>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : months === null ? (
        <p className="text-sm text-black/50">Loading month-end archive…</p>
      ) : months.length === 0 ? (
        <p className="text-sm text-black/60">
          No prior month-end stock has been imported yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10">
                <th className="px-4 py-3 font-medium">Month ending</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 text-right font-medium">New</th>
                <th className="px-4 py-3 text-right font-medium">Repaired/Used</th>
                <th className="px-4 py-3 text-right font-medium">To assess</th>
                <th className="px-4 py-3 text-right font-medium">Units</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.monthKey} className="border-b border-black/5">
                  <td className="px-4 py-3 font-medium">{month.label}</td>
                  <td className="px-4 py-3 text-black/70">
                    {month.sourceKind === "source_file"
                      ? "Workbook"
                      : `Copied from ${month.carriedForwardFromMonthKey}`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {month.newStock}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {month.repairedUsed}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {month.toAssess}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {month.units}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={pdfHref(month.monthKey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mr-3 text-xs font-semibold uppercase text-brand hover:underline"
                    >
                      Open PDF
                    </a>
                    <a
                      href={pdfHref(month.monthKey, true)}
                      className="text-xs font-semibold uppercase text-brand hover:underline"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {months && months.length > 0 ? (
        <CompositionMonths months={months} />
      ) : null}
    </section>
  );
}

function CompositionMonths({ months }: { months: MonthRow[] }) {
  const shown: MonthRow[] = [];
  let previous = "";
  for (const month of months) {
    const signature = JSON.stringify(month.composition ?? []);
    if (signature === previous) continue;
    previous = signature;
    shown.push(month);
  }
  return (
    <div className="space-y-8">
      {shown.map((month) => (
        <StockCompositionBlock
          key={month.monthKey}
          title={`What the ${month.label} totals are made of`}
          note="Only the models with a quantity in that column. They add up to the headline number. Months that repeat this mix are not listed again."
          columns={month.composition ?? []}
        />
      ))}
    </div>
  );
}
