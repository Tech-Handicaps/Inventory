"use client";

import { useEffect, useState } from "react";
import {
  formatSigned,
  type MonthOnMonthAudit,
} from "@/lib/reports/month-on-month-audit";
import { StockCompositionBlock } from "./stock-composition-block";

const PDF_HREF = "/api/reports/month-on-month/pdf";

export function MonthOnMonthSection() {
  const [audit, setAudit] = useState<MonthOnMonthAudit | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/month-on-month", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load the month-on-month audit");
        return res.json() as Promise<MonthOnMonthAudit>;
      })
      .then((body) => {
        if (!cancelled) setAudit(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the audit");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="month-on-month" className="scroll-mt-6 space-y-4">
      <header className="border-b border-black/10 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Prior-company month-on-month
          </h2>
          <div className="flex gap-2">
            <a
              href={PDF_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-2 text-xs"
            >
              Open PDF
            </a>
            <a href={`${PDF_HREF}?download=1`} className="btn-secondary py-2 text-xs">
              Download
            </a>
          </div>
        </div>
      </header>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : audit === null ? (
        <p className="text-sm text-black/50">Loading month-on-month audit…</p>
      ) : (
        <>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-black/70">
            {audit.explanation.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {audit.months.length === 0 ? (
            <p className="text-sm text-black/60">
              No prior month-end stock has been imported yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-4 py-3 font-medium">Month ending</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 text-right font-medium">New</th>
                    <th className="px-4 py-3 text-right font-medium">Repaired/Used</th>
                    <th className="px-4 py-3 text-right font-medium">Usable</th>
                    <th className="px-4 py-3 text-right font-medium">To assess</th>
                    <th className="px-4 py-3 text-right font-medium">To dispose</th>
                    <th className="px-4 py-3 text-right font-medium">Warranty</th>
                    <th className="px-4 py-3 text-right font-medium">Units</th>
                    <th className="px-4 py-3 text-right font-medium">Units vs prior</th>
                    <th className="px-4 py-3 font-medium">What changed</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.months.map((month) => (
                    <tr
                      key={`${month.monthKey}-${month.sourceKind}`}
                      className="border-b border-black/5"
                    >
                      <td className="px-4 py-3 font-medium">{month.label}</td>
                      <td className="px-4 py-3 text-black/70">{month.sourceLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.totals.newStock}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.totals.repairedUsed}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.totals.usable}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.totals.toAssess}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.totals.toDispose}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.totals.warrantyRepair}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.totals.units}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {month.delta ? formatSigned(month.delta.units) : "—"}
                      </td>
                      <td className="px-4 py-3 text-black/70">{month.movementNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(audit.stockBreakdowns ?? []).map((block) => (
            <StockCompositionBlock
              key={block.monthKey}
              title={`What the ${block.label} totals are made of`}
              note="These models add up to the New, Repaired/Used, and To assess figures for that month. A later month is listed only when the mix changes."
              columns={block.columns}
            />
          ))}

          {audit.movements.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-black/50">
                Line movements
              </h3>
              <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10">
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium">Make / model</th>
                      <th className="px-4 py-3 font-medium">Column</th>
                      <th className="px-4 py-3 text-right font-medium">Previous</th>
                      <th className="px-4 py-3 text-right font-medium">Current</th>
                      <th className="px-4 py-3 text-right font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.movements.map((movement) => (
                      <tr
                        key={`${movement.toMonthKey}-${movement.model}-${movement.column}`}
                        className="border-b border-black/5"
                      >
                        <td className="px-4 py-3">{movement.toLabel}</td>
                        <td className="px-4 py-3 font-medium">
                          {movement.manufacturer} {movement.model}
                        </td>
                        <td className="px-4 py-3 text-black/70">{movement.column}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {movement.previous}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {movement.current}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatSigned(movement.delta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
