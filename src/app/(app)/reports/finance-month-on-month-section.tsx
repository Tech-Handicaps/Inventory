"use client";

import { useEffect, useState } from "react";
import {
  formatFinanceChange,
  type FinanceMonthOnMonthReport,
} from "@/lib/reports/finance-month-on-month";

const PDF_HREF = "/api/reports/finance-month-on-month/pdf";

function changeCell(value: number | null) {
  if (value === null) return "—";
  return formatFinanceChange(value);
}

export function FinanceMonthOnMonthSection() {
  const [report, setReport] = useState<FinanceMonthOnMonthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/finance-month-on-month", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load the finance month-on-month report");
        return res.json() as Promise<FinanceMonthOnMonthReport>;
      })
      .then((body) => {
        if (!cancelled) setReport(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load the finance month-on-month report"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="finance-month-on-month" className="scroll-mt-6 space-y-4">
      <header className="border-b border-black/10 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Finance month-on-month
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
      ) : report === null ? (
        <p className="text-sm text-black/50">Loading finance month-on-month…</p>
      ) : (
        <>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-black/70">
            {report.introduction.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {report.months.length === 0 ? null : (
            <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="px-4 py-3 font-medium">Month ending</th>
                    <th className="px-4 py-3 text-right font-medium">New</th>
                    <th className="px-4 py-3 text-right font-medium">Refurbished</th>
                    <th className="px-4 py-3 text-right font-medium">Usable</th>
                    <th className="px-4 py-3 text-right font-medium">Deployed</th>
                    <th className="px-4 py-3 text-right font-medium">Assessment</th>
                    <th className="px-4 py-3 text-right font-medium">In repairs</th>
                    <th className="px-4 py-3 text-right font-medium">Written off</th>
                    <th className="px-4 py-3 text-right font-medium">Register</th>
                    <th className="px-4 py-3 text-right font-medium">Usable vs previous stored</th>
                    <th className="px-4 py-3 text-right font-medium">Register vs previous stored</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((month) => (
                    <tr key={month.monthKey} className="border-b border-black/5">
                      <td className="px-4 py-3 font-medium">{month.monthEndingLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.newStock}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.refurbished}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.usable}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.deployed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.assessment}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.inRepair}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.writtenOff}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{month.register}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {changeCell(month.usableChange)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {changeCell(month.registerChange)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.months.length === 0 ? null : (
            <div className="space-y-3">
              <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
                Make and model changes
              </h3>
              <p className="max-w-3xl text-sm leading-relaxed text-black/70">
                {report.movementNote}
              </p>
              {report.movements.length === 0 ? (
                <p className="text-sm text-black/60">
                  {report.months.length < 2
                    ? "The first stored month has no previous position to compare."
                    : "No make or model count changed from one stored month to the next."}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10">
                        <th className="px-4 py-3 font-medium">Month</th>
                        <th className="px-4 py-3 font-medium">Make / model</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Previous stored</th>
                        <th className="px-4 py-3 text-right font-medium">This month</th>
                        <th className="px-4 py-3 text-right font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.movements.map((movement) => (
                        <tr
                          key={`${movement.monthKey}-${movement.statusCode}-${movement.makeModel}`}
                          className="border-b border-black/5"
                        >
                          <td className="px-4 py-3">{movement.monthEndingLabel}</td>
                          <td className="px-4 py-3">{movement.makeModel}</td>
                          <td className="px-4 py-3">{movement.statusLabel}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{movement.previous}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{movement.current}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatFinanceChange(movement.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
