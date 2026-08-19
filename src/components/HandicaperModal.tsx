"use client";

import { useCallback, useEffect, useState } from "react";

export type HandicaperRequest = {
  metricKey: string;
  metricLabel: string;
  /** Optional page context so the API knows where the user is. */
  page?: string;
};

type BreakdownRow = {
  label: string;
  count: number;
  detail?: string;
};

type HandicaperResponse = {
  title: string;
  summary: string;
  breakdown: BreakdownRow[];
  note?: string;
  aiSummary?: string;
};

type Props = {
  open: boolean;
  request: HandicaperRequest | null;
  onClose: () => void;
};

export function HandicaperModal({ open, request, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HandicaperResponse | null>(null);

  const load = useCallback(async (req: HandicaperRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/ai/handicaper/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const j = (await r.json()) as HandicaperResponse & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Handicaper could not explain this metric");
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && request) void load(request);
  }, [open, request, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-black/10 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
            <span className="text-sm font-black text-brand">H</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold uppercase tracking-wide text-black">
              Handicaper
            </p>
            <p className="text-[10px] text-black/50">AI-powered metric breakdown</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-black/40 transition hover:bg-black/5 hover:text-black/70"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
              <p className="text-xs text-black/50">Handicaper is analysing…</p>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          ) : result ? (
            <>
              <h3 className="font-heading text-base font-bold text-black">
                {result.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-black/70">
                {result.summary}
              </p>

              {result.aiSummary ? (
                <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand/60">
                    Handicaper AI insight
                  </p>
                  <p className="text-sm leading-relaxed text-black/80">
                    {result.aiSummary}
                  </p>
                </div>
              ) : null}

              {result.breakdown.length > 0 ? (
                <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-[10px] font-bold uppercase tracking-wide text-black/45">
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.breakdown.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-black/5 last:border-0"
                        >
                          <td className="px-3 py-2 text-black/80">
                            <span className="font-medium">{row.label}</span>
                            {row.detail ? (
                              <span className="ml-1.5 text-[11px] text-black/45">
                                {row.detail}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right font-heading font-bold tabular-nums text-black">
                            {row.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {result.note ? (
                <p className="mt-3 text-xs leading-relaxed text-black/50">
                  {result.note}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 px-5 py-3">
          <p className="text-[10px] text-black/35">
            Handicaper · Powered by your live inventory data
          </p>
        </div>
      </div>
    </div>
  );
}
