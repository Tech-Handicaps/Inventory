"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  csvFilename,
  downloadCsv,
  rowsToCsv,
  wantsCsvExport,
} from "@/lib/csv/download-csv";
import { buildModalWelcomeMessage } from "@/lib/handicaper/welcome";

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

type StockBreakdownRow = {
  label: string;
  assetType: string;
  newStock: number;
  refurbished: number;
  total: number;
};

type AssetExportRow = {
  assetName: string;
  status: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  club: string;
  tags: string;
  dataSource: string;
  deviceLocation: string;
  dateUpdated: string;
};

type ClubMovementUnit = {
  assetName: string;
  status: string;
  statusCode: string;
  model: string;
  serialNumber: string;
  category: string;
  lastUpdated: string;
  writeOffReference?: string;
  writeOffReason?: string;
  replacementRequested?: boolean;
  replacementAssetName?: string;
  replacementMakeModel?: string;
  replacementSerialNumber?: string;
};

type ClubReplacementPair = {
  retiredAssetName: string;
  retiredModel: string;
  retiredSerial: string;
  writeOffReference: string;
  replacementAssetName: string;
  replacementModel: string;
  replacementSerial: string;
};

type ClubMovementEvent = {
  id: string;
  at: string;
  assetName: string;
  actionType: string;
  summary: string;
};

type ClubMovementSnapshot = {
  clubId: string;
  clubName: string;
  active: ClubMovementUnit[];
  retired: ClubMovementUnit[];
  replacementPairs: ClubReplacementPair[];
  timeline: ClubMovementEvent[];
  timelineTotal: number;
  generatedAt: string;
};

type Props = {
  open: boolean;
  request: HandicaperRequest | null;
  displayName?: string | null;
  onClose: () => void;
};

function welcomeMessage(name: string | null | undefined): string {
  return buildModalWelcomeMessage(name);
}

function downloadStockBreakdownCsv(rows: StockBreakdownRow[]): void {
  const csv = rowsToCsv(
    ["Model", "Asset type", "New stock", "Refurbished", "Total"],
    rows.map((row) => [
      row.label,
      row.assetType,
      row.newStock,
      row.refurbished,
      row.total,
    ])
  );
  downloadCsv(csvFilename("stock-by-model"), csv);
}

function downloadAssetRegistryCsv(rows: AssetExportRow[]): void {
  const csv = rowsToCsv(
    [
      "Asset name",
      "Status",
      "Category",
      "Manufacturer",
      "Model",
      "Serial number",
      "Club",
      "Tags",
      "Data source",
      "Location",
      "Last updated",
    ],
    rows.map((row) => [
      row.assetName,
      row.status,
      row.category,
      row.manufacturer,
      row.model,
      row.serialNumber,
      row.club,
      row.tags,
      row.dataSource,
      row.deviceLocation,
      row.dateUpdated,
    ])
  );
  downloadCsv(csvFilename("asset-registry"), csv);
}

function downloadClubMovementCsv(snapshot: ClubMovementSnapshot): void {
  const unitRows = (section: string, units: ClubMovementUnit[]) =>
    units.map((u) => [
      section,
      u.assetName,
      u.status,
      u.model,
      u.serialNumber,
      u.category,
      u.lastUpdated,
      u.writeOffReference ?? "",
      u.replacementAssetName ?? "",
    ]);

  const pairRows = snapshot.replacementPairs.map((p) => [
    "Replacement pair",
    `${p.retiredAssetName} → ${p.replacementAssetName}`,
    p.writeOffReference,
    `${p.retiredModel} → ${p.replacementModel}`,
    `${p.retiredSerial} → ${p.replacementSerial}`,
    "",
    "",
    p.writeOffReference,
    "",
  ]);

  const timelineRows = snapshot.timeline.map((e) => [
    "Timeline",
    e.assetName,
    e.actionType,
    e.summary,
    "",
    "",
    e.at.slice(0, 10),
    "",
    "",
  ]);

  const csv = rowsToCsv(
    [
      "Section",
      "Asset name",
      "Status / action",
      "Model / summary",
      "Serial",
      "Category",
      "Date",
      "Write-off ref",
      "Replacement (planned or matched)",
    ],
    [
      ...unitRows("Active", snapshot.active),
      ...unitRows("Written off", snapshot.retired),
      ...pairRows,
      ...timelineRows,
    ]
  );
  const slug = snapshot.clubName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  downloadCsv(csvFilename(`${slug || "club"}-movement`), csv);
}

function ClubUnitTable({
  units,
  variant,
}: {
  units: ClubMovementUnit[];
  variant: "active" | "retired";
}) {
  if (units.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-black/45">
        {variant === "active"
          ? "No active hardware linked to this club."
          : "No written-off units linked to this club."}
      </p>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-black/10 text-[10px] font-bold uppercase tracking-wide text-black/45">
          <th className="px-3 py-2 text-left">Asset</th>
          <th className="px-2 py-2 text-left">Status</th>
          <th className="px-2 py-2 text-left">Model</th>
          <th className="px-3 py-2 text-left">Serial</th>
        </tr>
      </thead>
      <tbody>
        {units.map((u) => (
          <tr
            key={u.assetName}
            className="border-b border-black/5 last:border-0"
          >
            <td className="px-3 py-2 font-medium text-black/80">{u.assetName}</td>
            <td className="px-2 py-2 text-black/55">{u.status}</td>
            <td className="px-2 py-2 text-black/55">{u.model}</td>
            <td className="px-3 py-2 text-black/45">{u.serialNumber || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClubMovementPanel({
  snapshot,
  onDownload,
}: {
  snapshot: ClubMovementSnapshot;
  onDownload: () => void;
}) {
  const timeline = snapshot.timeline ?? [];
  const timelineTotal = snapshot.timelineTotal ?? timeline.length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-black/10 bg-black/[0.02]">
        <div className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">
            {snapshot.clubName} · Club movement
          </p>
          <CsvDownloadButton label="Download CSV" onClick={onDownload} />
        </div>
        <p className="border-b border-black/10 px-3 py-2 text-xs text-black/55">
          {snapshot.active.length} active · {snapshot.retired.length} written off
          {snapshot.replacementPairs.length > 0
            ? ` · ${snapshot.replacementPairs.length} replacement pair${snapshot.replacementPairs.length === 1 ? "" : "s"} linked`
            : ""}
          {timelineTotal > 0
            ? ` · ${timelineTotal} timeline event${timelineTotal === 1 ? "" : "s"}`
            : ""}
        </p>
        <p className="border-b border-black/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-brand/60">
          Currently assigned
        </p>
        <ClubUnitTable units={snapshot.active} variant="active" />
        <p className="border-y border-black/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800/70">
          Written off / retired
        </p>
        <ClubUnitTable units={snapshot.retired} variant="retired" />
      </div>
      {snapshot.replacementPairs.length > 0 ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/50">
          <p className="border-b border-amber-200/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-900/70">
            Replacement pairs
          </p>
          <ul className="divide-y divide-amber-200/60 text-xs">
            {snapshot.replacementPairs.map((p) => (
              <li key={p.writeOffReference} className="px-3 py-2 leading-relaxed">
                <span className="font-medium text-black/75">{p.retiredAssetName}</span>
                <span className="text-black/40"> → </span>
                <span className="font-medium text-black/75">{p.replacementAssetName}</span>
                <span className="mt-0.5 block text-[10px] text-black/45">
                  {p.writeOffReference} · {p.retiredModel} replaced by {p.replacementModel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {timeline.length > 0 ? (
        <div className="rounded-xl border border-black/10 bg-white">
          <div className="border-b border-black/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">
              Movement timeline
            </p>
            <p className="mt-0.5 text-[10px] text-black/40">
              {timelineTotal > timeline.length
                ? `Showing latest ${timeline.length} of ${timelineTotal} events · oldest → newest`
                : `${timeline.length} event${timeline.length === 1 ? "" : "s"} · oldest → newest`}
            </p>
          </div>
          <ol className="relative max-h-64 space-y-0 overflow-y-auto border-l-2 border-brand/20 py-3 pl-5 pr-3 ml-3">
            {timeline.map((e) => (
              <li key={e.id} className="relative pb-3 last:pb-0">
                <span
                  className="absolute -left-[calc(0.5rem+6px)] top-1.5 h-2 w-2 rounded-full border-2 border-brand bg-white"
                  aria-hidden
                />
                <time
                  dateTime={e.at}
                  className="text-[10px] font-medium tabular-nums text-black/40"
                >
                  {new Date(e.at).toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <p className="text-xs font-medium text-black/80">{e.summary}</p>
                <p className="text-[10px] text-black/40">
                  {e.assetName}
                  <span className="mx-1 text-black/25">·</span>
                  {e.actionType}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-black/10 px-3 py-4 text-center text-xs text-black/45">
          No movement history recorded for this club yet.
        </div>
      )}
    </div>
  );
}

function downloadMetricBreakdownCsv(
  title: string,
  rows: BreakdownRow[]
): void {
  const csv = rowsToCsv(
    ["Item", "Detail", "Count"],
    rows.map((row) => [row.label, row.detail ?? "", row.count])
  );
  downloadCsv(csvFilename(title), csv);
}

function CsvDownloadButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/55 transition hover:border-brand/30 hover:text-brand"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
        />
      </svg>
      {label}
    </button>
  );
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
  const [stockBreakdown, setStockBreakdown] = useState<StockBreakdownRow[] | null>(
    null
  );
  const [assetExport, setAssetExport] = useState<AssetExportRow[] | null>(null);
  const [clubMovement, setClubMovement] = useState<ClubMovementSnapshot | null>(
    null
  );
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
      setStockBreakdown(null);
      setAssetExport(null);
      setClubMovement(null);
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
      const j = (await r.json()) as {
        reply?: string;
        error?: string;
        stockBreakdown?: StockBreakdownRow[];
        assetExport?: AssetExportRow[];
        clubMovement?: ClubMovementSnapshot;
      };
      if (!r.ok) throw new Error(j.error ?? "Handicaper could not respond");
      setChatMessages([
        ...nextHistory,
        { role: "assistant", content: j.reply ?? "I couldn't generate a reply." },
      ]);
      const breakdown = j.stockBreakdown ?? null;
      const assets = j.assetExport ?? null;
      const club = j.clubMovement ?? null;
      setStockBreakdown(breakdown);
      setAssetExport(assets);
      setClubMovement(club);
      if (wantsCsvExport(text)) {
        if (club) {
          downloadClubMovementCsv(club);
        } else if (assets && assets.length > 0) {
          downloadAssetRegistryCsv(assets);
        } else if (breakdown && breakdown.length > 0) {
          downloadStockBreakdownCsv(breakdown);
        }
      }
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
              {clubMovement ? (
                <ClubMovementPanel
                  snapshot={clubMovement}
                  onDownload={() => downloadClubMovementCsv(clubMovement)}
                />
              ) : null}
              {assetExport && assetExport.length > 0 ? (
                <div className="rounded-xl border border-black/10 bg-black/[0.02]">
                  <div className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">
                      Asset registry · {assetExport.length} assets
                    </p>
                    <CsvDownloadButton
                      label="Download CSV"
                      onClick={() => downloadAssetRegistryCsv(assetExport)}
                    />
                  </div>
                  <p className="px-3 py-2 text-xs leading-relaxed text-black/55">
                    Full export with status, category, manufacturer, model, serial
                    number, club, tags, and location.
                  </p>
                </div>
              ) : null}
              {stockBreakdown && stockBreakdown.length > 0 ? (
                <div className="rounded-xl border border-black/10 bg-black/[0.02]">
                  <div className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">
                      In stock by model
                    </p>
                    <CsvDownloadButton
                      label="Download CSV"
                      onClick={() => downloadStockBreakdownCsv(stockBreakdown)}
                    />
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-black/10 text-[10px] font-bold uppercase tracking-wide text-black/45">
                        <th className="px-3 py-2 text-left">Model</th>
                        <th className="px-2 py-2 text-left">Type</th>
                        <th className="px-2 py-2 text-right">New</th>
                        <th className="px-2 py-2 text-right">Refurb</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockBreakdown.map((row) => (
                        <tr
                          key={`${row.assetType}-${row.label}`}
                          className="border-b border-black/5 last:border-0"
                        >
                          <td className="px-3 py-2 font-medium text-black/80">
                            {row.label}
                          </td>
                          <td className="px-2 py-2 text-black/50">{row.assetType}</td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {row.newStock}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {row.refurbished}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums">
                            {row.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <div className="flex items-center justify-between gap-2 border-b border-black/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">
                      Breakdown
                    </p>
                    <CsvDownloadButton
                      label="Download CSV"
                      onClick={() =>
                        downloadMetricBreakdownCsv(
                          metricResult.title,
                          metricResult.breakdown
                        )
                      }
                    />
                  </div>
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
                placeholder="Ask about stock, clubs, CSV export…"
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
