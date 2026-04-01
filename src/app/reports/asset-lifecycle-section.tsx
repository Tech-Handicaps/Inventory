"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AssetOption = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  status: { label: string; code: string };
};

type AuditRow = {
  id: string;
  actionType: string;
  timestamp: string;
  notes: string | null;
  metadata: unknown;
};

function formatTransitionSummary(row: AuditRow): string {
  const meta = row.metadata as Record<string, unknown> | null;
  if (!meta || typeof meta !== "object") return row.notes ?? row.actionType;

  if (row.actionType === "asset.created") {
    const code = meta.statusCode;
    return `Added to inventory${typeof code === "string" ? ` (${code})` : ""}`;
  }

  if (row.actionType === "asset.write_off") {
    return "Written off";
  }

  if (row.actionType === "repair.created") {
    const st = meta.repairStatus;
    return `Repair logged${typeof st === "string" ? ` (${st})` : ""}`;
  }

  if (row.actionType === "asset.updated") {
    const changes = meta.changes as Record<string, unknown> | undefined;
    const statusCh = changes?.statusCode as
      | { from?: string; to?: string }
      | undefined;
    if (statusCh?.from != null && statusCh?.to != null) {
      return `Lifecycle: ${String(statusCh.from)} → ${String(statusCh.to)}`;
    }
    if (changes && Object.keys(changes).length > 0) {
      return `Updated (${Object.keys(changes).join(", ")})`;
    }
  }

  return row.notes ?? row.actionType;
}

export function AssetLifecycleSection() {
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetId, setAssetId] = useState("");
  const [timeline, setTimeline] = useState<AuditRow[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/assets?limit=500");
      const j = await res.json();
      const list = (j.assets ?? []) as AssetOption[];
      setAssets(
        Array.isArray(list)
          ? [...list].sort((a, b) =>
              a.assetName.localeCompare(b.assetName, undefined, {
                sensitivity: "base",
              })
            )
          : []
      );
    } catch {
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    loadAssets().catch(console.error);
  }, [loadAssets]);

  const loadTimeline = useCallback(async (id: string) => {
    if (!id) {
      setTimeline([]);
      return;
    }
    setLoadingLog(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/audit-logs?assetId=${encodeURIComponent(id)}&limit=200`
      );
      if (!res.ok) {
        throw new Error("Could not load history");
      }
      const j = await res.json();
      const items = (j.items ?? []) as AuditRow[];
      const sorted = [...items].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setTimeline(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setTimeline([]);
    } finally {
      setLoadingLog(false);
    }
  }, []);

  useEffect(() => {
    loadTimeline(assetId).catch(console.error);
  }, [assetId, loadTimeline]);

  const selected = useMemo(
    () => assets.find((a) => a.id === assetId),
    [assets, assetId]
  );

  return (
    <section
      id="lifecycle"
      className="rounded-xl border border-black/10 bg-white p-6 shadow-sm"
    >
      <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
        Asset lifecycle / movement
      </h2>
      <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
      <p className="mt-4 text-sm leading-relaxed text-black/70">
        Track how a unit moved through your stages (for example new stock → in
        stock with clubs → repair → refurbished → written off). Movement is built
        from the <strong>audit log</strong> when someone changes status on the
        hardware board or updates the asset. The{" "}
        <strong>Dashboard</strong> shows totals across all assets; this view is{" "}
        <strong>one asset at a time</strong>.
      </p>

      <div className="mt-6 max-w-xl">
        <label
          htmlFor="lifecycle-asset"
          className="text-xs font-medium text-black/70"
        >
          Select asset
        </label>
        <select
          id="lifecycle-asset"
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          disabled={loadingAssets}
          className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
        >
          <option value="">
            {loadingAssets ? "Loading…" : "— Choose an asset —"}
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.assetName}
              {a.serialNumber ? ` · S/N ${a.serialNumber}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <p className="mt-4 text-xs text-black/55">
          Current stage:{" "}
          <strong className="text-black">{selected.status.label}</strong> (
          {selected.status.code})
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {assetId ? (
        <div className="mt-6">
          {loadingLog ? (
            <p className="text-sm text-black/55">Loading history…</p>
          ) : timeline.length === 0 ? (
            <p className="rounded-lg border border-dashed border-black/15 bg-black/[0.02] px-4 py-6 text-sm text-black/55">
              No audit entries for this asset yet. History appears after the
              asset is created or updated (for example when you change stage on
              the board).
            </p>
          ) : (
            <ol className="relative space-y-0 border-l-2 border-brand/30 pl-6">
              {timeline.map((row) => (
                <li key={row.id} className="relative pb-6 last:pb-0">
                  <span
                    className="absolute -left-[calc(0.5rem+5px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-brand bg-white"
                    aria-hidden
                  />
                  <time
                    dateTime={row.timestamp}
                    className="text-xs font-medium tabular-nums text-black/45"
                  >
                    {new Date(row.timestamp).toLocaleString()}
                  </time>
                  <p className="mt-0.5 text-sm font-medium text-black">
                    {formatTransitionSummary(row)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-black/40">
                    {row.actionType}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
