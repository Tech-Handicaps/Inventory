"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssetSearchFields } from "@/lib/inventory/asset-search";
import { matchesAssetSearch } from "@/lib/inventory/asset-search";

/** API returns full asset rows; we only rely on searchable fields plus id for keys. */
type PickerAsset = AssetSearchFields & { id: string };

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

type Props = {
  /** When false, audit timeline is hidden and not fetched (e.g. accountant). */
  auditAccess?: boolean;
};

export function AssetLifecycleSection({ auditAccess = true }: Props) {
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [pickerQuery, setPickerQuery] = useState("");
  const [assetId, setAssetId] = useState("");
  const [timeline, setTimeline] = useState<AuditRow[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/assets?limit=500");
      const j = await res.json();
      const list = (j.assets ?? []) as PickerAsset[];
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
    if (!auditAccess) {
      setTimeline([]);
      setLoadingLog(false);
      setError(null);
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
  }, [auditAccess]);

  useEffect(() => {
    loadTimeline(assetId).catch(console.error);
  }, [assetId, loadTimeline]);

  const selected = useMemo(
    () => assets.find((a) => a.id === assetId),
    [assets, assetId]
  );

  const pickerOptions = useMemo(() => {
    const filtered = assets.filter(
      (a) => matchesAssetSearch(a, pickerQuery) || a.id === assetId
    );
    return filtered.sort((a, b) =>
      a.assetName.localeCompare(b.assetName, undefined, {
        sensitivity: "base",
      })
    );
  }, [assets, pickerQuery, assetId]);

  /** True when filter text would hide the chosen row; we keep it visible in options. */
  const pickerSelectionPinned = useMemo(() => {
    if (!pickerQuery.trim() || !assetId) return false;
    const cur = assets.find((a) => a.id === assetId);
    return cur ? !matchesAssetSearch(cur, pickerQuery) : false;
  }, [assets, assetId, pickerQuery]);

  return (
    <section
      id="lifecycle"
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
    >
      <div className="border-b border-black/8 bg-gradient-to-r from-brand-muted/80 to-white px-6 py-5 sm:px-8">
        <p className="font-heading text-[10px] font-bold uppercase tracking-[0.18em] text-brand-hover">
          Per-asset history
        </p>
        <h2 className="font-heading mt-1 text-lg font-bold uppercase tracking-wide text-black">
          Asset lifecycle / movement
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/65">
          Follow how a unit moved through stages (new stock → field → repair →
          refurbished → written off).
          {auditAccess ? (
            <>
              {" "}
              Built from the <strong>audit log</strong> when status changes on
              the hardware board. Dashboard shows totals; this view is{" "}
              <strong>one asset at a time</strong>.
            </>
          ) : (
            <>
              {" "}
              Audit history is not available for your role; you can still see
              each asset&apos;s current stage.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-10">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="lifecycle-asset-search"
              className="text-xs font-medium text-black/70"
            >
              Filter assets
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="lifecycle-asset-search"
                type="search"
                enterKeyHint="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                disabled={loadingAssets || assets.length === 0}
                placeholder="Name, club, serial, template…"
                className="min-w-0 flex-1 rounded-lg border border-black/15 bg-surface/50 px-3 py-2.5 text-sm outline-none ring-brand/30 focus:border-brand/50 focus:bg-white focus:ring-2"
                autoComplete="off"
                aria-label="Search assets for lifecycle picker"
              />
              {pickerQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setPickerQuery("")}
                  disabled={loadingAssets || assets.length === 0}
                  className="shrink-0 rounded-lg border border-black/15 px-3 py-2 text-xs font-medium text-black/70 hover:bg-black/[0.04]"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {!loadingAssets && assets.length ? (
              <p className="mt-1.5 text-[11px] text-black/50">
                Showing{" "}
                <strong className="tabular-nums text-black/70">
                  {pickerOptions.length}
                </strong>{" "}
                of {assets.length}
                {pickerSelectionPinned ? (
                  <span className="text-black/45">
                    {" "}
                    (selection kept visible)
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div>
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
              className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">
                {loadingAssets ? "Loading…" : "— Choose an asset —"}
              </option>
              {pickerOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetName}
                  {a.serialNumber ? ` · S/N ${a.serialNumber}` : ""}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div className="rounded-xl border border-brand/20 bg-brand-muted/40 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-hover">
                Current stage
              </p>
              <p className="mt-0.5 font-heading text-sm font-bold text-black">
                {selected.status.label}
              </p>
              <p className="text-[11px] tabular-nums text-black/45">
                {selected.status.code}
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-black/15 bg-surface/60 px-4 py-6 text-center text-sm text-black/45">
              Select an asset to view its stage
              {auditAccess ? " and movement history" : ""}.
            </p>
          )}
        </div>

        <div className="min-w-0">
          {error ? (
            <p className="mb-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {!auditAccess ? (
            <p className="rounded-xl border border-dashed border-black/12 bg-surface/50 px-4 py-8 text-center text-sm text-black/50">
              Movement timeline requires an admin role.
            </p>
          ) : !assetId ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-black/12 bg-surface/40 px-4">
              <p className="text-sm text-black/45">
                Timeline appears here after you choose an asset.
              </p>
            </div>
          ) : loadingLog ? (
            <p className="text-sm text-black/55">Loading history…</p>
          ) : timeline.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/15 bg-surface/50 px-4 py-8 text-sm text-black/55">
              No audit entries yet. History appears after the asset is created
              or its stage is changed on the board.
            </p>
          ) : (
            <div>
              <h3 className="font-heading mb-4 text-xs font-bold uppercase tracking-[0.15em] text-black/45">
                Movement timeline · {timeline.length} events
              </h3>
              <ol className="relative space-y-0 border-l-2 border-brand/25 pl-6">
                {timeline.map((row) => (
                  <li key={row.id} className="relative pb-6 last:pb-0">
                    <span
                      className="absolute -left-[calc(0.5rem+5px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-brand bg-white shadow-sm"
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

