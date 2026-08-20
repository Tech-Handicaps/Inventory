"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type HandicaperRequest = {
  mode?: "metric" | "chat";
  metricKey?: string;
  metricLabel?: string;
  page?: string;
};

type BreakdownRow = {
  label: string;
  count: number;
  detail?: string;
};

type MetricResponse = {
  title: string;
  summary: string;
  breakdown: BreakdownRow[];
  note?: string;
  aiSummary?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  open: boolean;
  request: HandicaperRequest | null;
  displayName?: string | null;
  onClose: () => void;
};

function welcomeMessage(name: string | null | undefined): string {
  const who = name ? name : "there";
  return `Hi ${who}! Welcome to the HNA Inventory system. I'm Handicaper — ask me about assets, stock levels, deployments, repairs, or anything on this page.`;
}

export function HandicaperModal({
  open,
  request,
  displayName,
  onClose,
}: Props) {
  const [metricLoading, setMetricLoading] = useState(false);
  const [metricError, setMetricError] = useState<string | null>(null);
  const [metricResult, setMetricResult] = useState<MetricResponse | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isChat = request?.mode === "chat" || !request?.metricKey;

  const loadMetric = useCallback(async (req: HandicaperRequest) => {
    if (!req.metricKey) return;
    setMetricLoading(true);
    setMetricError(null);
    setMetricResult(null);
    try {
      const r = await fetch("/api/ai/handicaper/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const j = (await r.json()) as MetricResponse & { error?: string };
      if (!r.ok) {
        throw new Error(j.error ?? "Handicaper could not explain this metric");
      }
      setMetricResult(j);
    } catch (e) {
      setMetricError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setMetricLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !request) return;
    if (isChat) {
      setChatMessages([{ role: "assistant", content: welcomeMessage(displayName) }]);
      setChatInput("");
      setChatError(null);
      setMetricResult(null);
      setMetricError(null);
    } else {
      void loadMetric(request);
      setChatMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal request changes
  }, [open, request, isChat, loadMetric]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const r = await fetch("/api/ai/handicaper/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          page: request?.page,
          history: chatMessages.filter((m) => m.role === "user" || m.role === "assistant"),
        }),
      });
      const j = (await r.json()) as { reply?: string; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Handicaper could not respond");
      setChatMessages([
        ...nextHistory,
        { role: "assistant", content: j.reply ?? "I couldn't generate a reply." },
      ]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, request?.page]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative mx-4 flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 max-h-[85vh]">
        <div className="flex items-center gap-3 border-b border-black/10 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
            <span className="text-sm font-black text-brand">H</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-sm font-bold uppercase tracking-wide text-black">
              Handicaper
            </p>
            <p className="text-[10px] text-black/50">
              {isChat ? "AI inventory assistant" : "Metric breakdown"}
            </p>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isChat ? (
            <div className="space-y-3">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-brand text-white"
                        : "border border-black/10 bg-black/[0.03] text-black/80"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading ? (
                <div className="flex items-center gap-2 text-xs text-black/50">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                  Handicaper is thinking…
                </div>
              ) : null}
              {chatError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  {chatError}
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
          ) : metricLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
              <p className="text-xs text-black/50">Handicaper is analysing…</p>
            </div>
          ) : metricError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {metricError}
            </div>
          ) : metricResult ? (
            <>
              <h3 className="font-heading text-base font-bold text-black">
                {metricResult.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-black/70">
                {metricResult.summary}
              </p>
              {metricResult.aiSummary ? (
                <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-4 py-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand/60">
                    Handicaper AI insight
                  </p>
                  <p className="text-sm leading-relaxed text-black/80">
                    {metricResult.aiSummary}
                  </p>
                </div>
              ) : null}
              {metricResult.breakdown.length > 0 ? (
                <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-[10px] font-bold uppercase tracking-wide text-black/45">
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricResult.breakdown.map((row, i) => (
                        <tr key={i} className="border-b border-black/5 last:border-0">
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
              {metricResult.note ? (
                <p className="mt-3 text-xs leading-relaxed text-black/50">
                  {metricResult.note}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {isChat ? (
          <div className="border-t border-black/10 px-4 py-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendChat();
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about inventory, assets, stock…"
                className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2 text-sm outline-none ring-brand/30 focus:ring-2"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="border-t border-black/10 px-5 py-3">
            <p className="text-[10px] text-black/35">
              Handicaper · Powered by your live inventory data
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
