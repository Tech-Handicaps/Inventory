"use client";

import { SectionSkeleton } from "@/components/Skeleton";
import { useEffect, useState } from "react";
import type { StockHandover } from "@/lib/reports/stock-handover";

const PDF_HREF = "/api/reports/handover/pdf";

export function HandoverSection() {
  const [handover, setHandover] = useState<StockHandover | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/handover", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load the stock handover");
        return res.json() as Promise<StockHandover>;
      })
      .then((body) => {
        if (!cancelled) setHandover(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the handover");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="handover" className="scroll-mt-6 space-y-4">
      <header className="border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-heading text-base font-bold text-ink">Stock report handover</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">How each prior-company line maps onto this system’s register; the two totals are never added.</p>
          </div>
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
      ) : handover === null ? (
        <SectionSkeleton label="Loading stock handover" />
      ) : (
        <>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink">
            {handover.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Series</th>
                  <th className="px-4 py-3 font-medium">What it records</th>
                </tr>
              </thead>
              <tbody>
                {handover.events.map((event) => (
                  <tr key={event.dateLabel} className="border-b border-line">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {event.dateLabel}
                    </td>
                    <td className="px-4 py-3 text-ink">{event.series}</td>
                    <td className="px-4 py-3 text-ink">{event.statement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-6">
            {handover.outcomes.map((outcome) => (
              <div key={outcome.id} className="space-y-2">
                <h3 className="font-heading text-sm font-bold text-ink">
                  {outcome.title}
                </h3>
                <p className="max-w-3xl text-sm leading-relaxed text-ink">
                  {outcome.statement}
                </p>
                <div className="overflow-x-auto rounded-lg border border-line bg-white">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Where it is counted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outcome.lines.map((line) => (
                        <tr key={line.name} className="border-b border-line">
                          <td className="px-4 py-3 font-medium">{line.name}</td>
                          <td className="px-4 py-3 text-ink">{line.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
