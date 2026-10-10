"use client";

import { useEffect, useState } from "react";
import { formatFinanceChange } from "@/lib/reports/finance-month-on-month";
import type { FinanceTypeTotals } from "@/lib/reports/finance-month-on-month";
import {
  FINANCE_YEAR_TYPE_NOTE,
  WORKBOOK_GROUP_NOTE,
  type FinanceYearlyReport,
} from "@/lib/reports/finance-yearly";
import type { WorkbookGroupRow } from "@/lib/reports/legacy-month-end";

const PDF_HREF = "/api/reports/finance-yearly/pdf";

function changeCell(value: number | null) {
  if (value === null) return "—";
  return formatFinanceChange(value);
}

function sumGroups(groups: WorkbookGroupRow[]): WorkbookGroupRow {
  return groups.reduce(
    (acc, row) => ({
      groupLabel: "Total",
      newStock: acc.newStock + row.newStock,
      repairedUsed: acc.repairedUsed + row.repairedUsed,
      usable: acc.usable + row.usable,
      toAssess: acc.toAssess + row.toAssess,
      toDispose: acc.toDispose + row.toDispose,
      warrantyRepair: acc.warrantyRepair + row.warrantyRepair,
      units: acc.units + row.units,
    }),
    {
      groupLabel: "Total",
      newStock: 0,
      repairedUsed: 0,
      usable: 0,
      toAssess: 0,
      toDispose: 0,
      warrantyRepair: 0,
      units: 0,
    }
  );
}

function workbookCells(row: WorkbookGroupRow) {
  return (
    <>
      <td className="px-4 py-3 text-right tabular-nums">{row.newStock}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.repairedUsed}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.usable}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.toAssess}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.toDispose}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.warrantyRepair}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.units}</td>
    </>
  );
}

function registerCells(row: FinanceTypeTotals) {
  return (
    <>
      <td className="px-4 py-3 text-right tabular-nums">{row.newStock}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.refurbished}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.usable}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.deployed}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.assessment}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.inRepair}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.writtenOff}</td>
      <td className="px-4 py-3 text-right tabular-nums">{row.register}</td>
    </>
  );
}

export function FinanceYearlySection() {
  const [report, setReport] = useState<FinanceYearlyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/finance-yearly", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load the finance yearly report");
        return res.json() as Promise<FinanceYearlyReport>;
      })
      .then((body) => {
        if (!cancelled) setReport(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load the finance yearly report"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const workbook = report?.workbook2025;
  const finance = report?.finance2026;

  return (
    <section id="finance-yearly" className="scroll-mt-6 space-y-4">
      <header className="border-b border-black/10 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            Finance yearly
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
        <p className="text-sm text-black/50">Loading finance yearly…</p>
      ) : (
        <>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-black/70">
            {report.introduction.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
              2025 — December workbook
            </h3>
            {workbook ? (
              <>
                <p className="max-w-3xl text-sm leading-relaxed text-black/70">{workbook.basis}</p>
                <p className="text-xs text-black/50">
                  {workbook.sourceLabel} · {workbook.monthEndingLabel}
                </p>
                <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10">
                        <th className="px-4 py-3 font-medium">Year</th>
                        <th className="px-4 py-3 text-right font-medium">New</th>
                        <th className="px-4 py-3 text-right font-medium">Repaired/Used</th>
                        <th className="px-4 py-3 text-right font-medium">Usable</th>
                        <th className="px-4 py-3 text-right font-medium">To assess</th>
                        <th className="px-4 py-3 text-right font-medium">To dispose</th>
                        <th className="px-4 py-3 text-right font-medium">Warranty</th>
                        <th className="px-4 py-3 text-right font-medium">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 font-medium">2025</td>
                        <td className="px-4 py-3 text-right tabular-nums">{workbook.newStock}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{workbook.repairedUsed}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{workbook.usable}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{workbook.toAssess}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{workbook.toDispose}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{workbook.warrantyRepair}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{workbook.units}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <h4 className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-black/50">
                  What the 2025 totals are made of
                </h4>
                <p className="max-w-3xl text-sm leading-relaxed text-black/70">
                  {WORKBOOK_GROUP_NOTE}
                </p>
                <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10">
                        <th className="px-4 py-3 font-medium">Section</th>
                        <th className="px-4 py-3 text-right font-medium">New</th>
                        <th className="px-4 py-3 text-right font-medium">Repaired/Used</th>
                        <th className="px-4 py-3 text-right font-medium">Usable</th>
                        <th className="px-4 py-3 text-right font-medium">To assess</th>
                        <th className="px-4 py-3 text-right font-medium">To dispose</th>
                        <th className="px-4 py-3 text-right font-medium">Warranty</th>
                        <th className="px-4 py-3 text-right font-medium">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workbook.groups.map((row) => (
                        <tr key={row.groupLabel} className="border-b border-black/5">
                          <td className="px-4 py-3 font-medium">{row.groupLabel}</td>
                          {workbookCells(row)}
                        </tr>
                      ))}
                      <tr>
                        <td className="px-4 py-3 font-semibold">Total</td>
                        {workbookCells(sumGroups(workbook.groups))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-black/60">The December 2025 workbook is not on file.</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
              2026 — {finance?.closed ? "closing finance pack" : "open year"}
            </h3>
            <p className="max-w-3xl text-sm leading-relaxed text-black/70">{finance?.basis}</p>
            {finance?.closing ? (
              <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10">
                      <th className="px-4 py-3 font-medium">Closing month</th>
                      <th className="px-4 py-3 text-right font-medium">New</th>
                      <th className="px-4 py-3 text-right font-medium">Refurbished</th>
                      <th className="px-4 py-3 text-right font-medium">Usable</th>
                      <th className="px-4 py-3 text-right font-medium">Deployed</th>
                      <th className="px-4 py-3 text-right font-medium">Assessment</th>
                      <th className="px-4 py-3 text-right font-medium">In repairs</th>
                      <th className="px-4 py-3 text-right font-medium">Written off</th>
                      <th className="px-4 py-3 text-right font-medium">Register</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 font-medium">{finance.closing.monthEndingLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.newStock}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.refurbished}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.usable}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.deployed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.assessment}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.inRepair}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.writtenOff}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{finance.closing.register}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
            {finance?.closing && finance.closing.types.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-black/50">
                  What the 2026 closing row is made of
                </h4>
                <p className="max-w-3xl text-sm leading-relaxed text-black/70">
                  {FINANCE_YEAR_TYPE_NOTE}
                </p>
                <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10">
                        <th className="px-4 py-3 font-medium">Heading</th>
                        <th className="px-4 py-3 text-right font-medium">New</th>
                        <th className="px-4 py-3 text-right font-medium">Refurbished</th>
                        <th className="px-4 py-3 text-right font-medium">Usable</th>
                        <th className="px-4 py-3 text-right font-medium">Deployed</th>
                        <th className="px-4 py-3 text-right font-medium">Assessment</th>
                        <th className="px-4 py-3 text-right font-medium">In repairs</th>
                        <th className="px-4 py-3 text-right font-medium">Written off</th>
                        <th className="px-4 py-3 text-right font-medium">Register</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finance.closing.types.map((row) => (
                        <tr key={row.assetType} className="border-b border-black/5">
                          <td className="px-4 py-3 font-medium">{row.label}</td>
                          {registerCells(row)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : finance?.closing ? (
              <p className="text-sm text-black/60">
                Asset-type totals were not stored with this pack.
              </p>
            ) : null}
            {finance && finance.months.length > 0 ? (
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
                    {finance.months.map((month) => (
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
            ) : null}
            {finance && finance.typeBlocks.length > 0 ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-black/50">
                    2026 headings by stored month
                  </h4>
                  <p className="max-w-3xl text-sm leading-relaxed text-black/70">
                    {finance.typeNote} A change is against the previous stored month of that same
                    heading.
                  </p>
                </div>
                {finance.typeBlocks.map((block) => (
                  <div key={block.assetType} className="space-y-2">
                    <h5 className="text-sm font-medium text-black">{block.label}</h5>
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
                            <th className="px-4 py-3 text-right font-medium">
                              Usable vs previous stored
                            </th>
                            <th className="px-4 py-3 text-right font-medium">
                              Register vs previous stored
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {block.months.map((month) => (
                            <tr key={month.monthKey} className="border-b border-black/5">
                              <td className="px-4 py-3 font-medium">{month.monthEndingLabel}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{month.newStock}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {month.refurbished}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">{month.usable}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{month.deployed}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {month.assessment}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">{month.inRepair}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {month.writtenOff}
                              </td>
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
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
