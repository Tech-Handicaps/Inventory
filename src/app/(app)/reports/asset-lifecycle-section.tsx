"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssetSearchFields } from "@/lib/inventory/asset-search";
import { matchesAssetSearch } from "@/lib/inventory/asset-search";

type WriteOffSummary = {
  referenceNumber: string;
  replacementRequested: boolean;
  replacementAssetName: string | null;
  clubName: string | null;
};

type PickerAsset = AssetSearchFields & {
  id: string;
  dateUpdated?: string;
  writeOffSummary?: WriteOffSummary | null;
};

type Club = { id: string; name: string };

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
    const cert =
      typeof meta.writeOffCertificate === "string"
        ? meta.writeOffCertificate
        : null;
    const replacement = meta.replacementRequested === true;
    const replacementName =
      typeof meta.replacementAssetName === "string"
        ? meta.replacementAssetName
        : null;
    let summary = cert ? `Written off (${cert})` : "Written off";
    if (replacement) {
      summary += replacementName
        ? ` — replacement requested: ${replacementName}`
        : " — replacement hardware requested";
    }
    const reason =
      typeof meta.writeOffReason === "string" ? meta.writeOffReason : null;
    if (reason) summary += ` · ${reason}`;
    return summary;
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
    const clubCh = changes?.clubId as
      | { from?: string | null; to?: string | null }
      | undefined;
    if (clubCh?.to != null && clubCh.from !== clubCh.to) {
      return clubCh.from ? "Club assignment changed" : "Assigned to club";
    }
    if (changes && Object.keys(changes).length > 0) {
      return `Updated (${Object.keys(changes).join(", ")})`;
    }
  }

  if (row.actionType === "assessment.completed") {
    const ref = meta.referenceNumber;
    const outcome = meta.outcome;
    const replacement = meta.replacementRequested === true;
    let s = `Assessment completed${typeof ref === "string" ? ` (${ref})` : ""}`;
    if (typeof outcome === "string") s += ` → ${outcome.replace(/_/g, " ")}`;
    if (replacement) s += " · replacement requested";
    return s;
  }

  return row.notes ?? row.actionType;
}

function assetPickerLabel(a: PickerAsset): string {
  const parts = [a.assetName];
  if (a.serialNumber) parts.push(`S/N ${a.serialNumber}`);
  parts.push(`[${a.status.label}]`);
  if (a.writeOffSummary?.replacementRequested) {
    parts.push("↳ replacement requested");
  }
  return parts.join(" · ");
}

function formatShortDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AssetStageCard({
  asset,
  selected,
  onSelect,
  variant,
}: {
  asset: PickerAsset;
  selected: boolean;
  onSelect: () => void;
  variant: "active" | "retired";
}) {
  const updated = formatShortDate(asset.dateUpdated);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? variant === "retired"
            ? "border-amber-400/60 bg-amber-50/80 ring-2 ring-amber-300/40"
            : "border-brand/50 bg-brand-muted/60 ring-2 ring-brand/25"
          : variant === "retired"
            ? "border-amber-200/80 bg-white hover:border-amber-300 hover:bg-amber-50/40"
            : "border-brand/15 bg-white hover:border-brand/30 hover:bg-brand-muted/20"
      }`}
    >
      <p className="font-heading text-sm font-bold text-black">{asset.assetName}</p>
      {asset.serialNumber ? (
        <p className="mt-0.5 text-xs text-black/55">S/N {asset.serialNumber}</p>
      ) : null}
      <p className="mt-2 text-xs font-medium text-black/70">{asset.status.label}</p>
      {updated ? (
        <p className="mt-1 text-[10px] text-black/45">Last updated {updated}</p>
      ) : null}
      {variant === "retired" && asset.writeOffSummary ? (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/70">
            {asset.writeOffSummary.referenceNumber}
          </p>
          {asset.writeOffSummary.replacementRequested ? (
            <p className="rounded-md bg-amber-100/80 px-2 py-1 text-[11px] text-amber-950">
              Replacement requested
              {asset.writeOffSummary.replacementAssetName
                ? `: ${asset.writeOffSummary.replacementAssetName}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

function ClubStageBlock({
  title,
  subtitle,
  assets,
  selectedId,
  onSelect,
  variant,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  assets: PickerAsset[];
  selectedId: string;
  onSelect: (id: string) => void;
  variant: "active" | "retired";
  emptyMessage: string;
}) {
  const headerClass =
    variant === "retired"
      ? "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white"
      : "border-brand/20 bg-gradient-to-br from-brand-muted/70 to-white";

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${variant === "retired" ? "border-amber-200/80" : "border-brand/20"}`}
    >
      <header className={`border-b px-5 py-4 ${headerClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-black">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-black/55">{subtitle}</p>
          </div>
          <span
            className={`funky-badge shrink-0 ${variant === "retired" ? "border-amber-300/60" : ""}`}
          >
            {assets.length}
          </span>
        </div>
      </header>
      <div className="space-y-3 p-4">
        {assets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/10 bg-surface/50 px-4 py-8 text-center text-sm text-black/45">
            {emptyMessage}
          </p>
        ) : (
          assets.map((a) => (
            <AssetStageCard
              key={a.id}
              asset={a}
              selected={selectedId === a.id}
              onSelect={() => onSelect(a.id)}
              variant={variant}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TimelinePanel({
  asset,
  timeline,
  loading,
  auditAccess,
}: {
  asset: PickerAsset | undefined;
  timeline: AuditRow[];
  loading: boolean;
  auditAccess: boolean;
}) {
  if (!asset) {
    return (
      <div className="rounded-2xl border border-dashed border-black/12 bg-surface/40 px-6 py-10 text-center">
        <p className="text-sm text-black/45">
          Select a unit above to view its movement timeline.
        </p>
      </div>
    );
  }

  if (!auditAccess) {
    return (
      <div className="rounded-2xl border border-dashed border-black/12 bg-surface/50 px-6 py-10 text-center text-sm text-black/50">
        Movement timeline requires an admin role.
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-black/55">Loading history…</p>;
  }

  if (timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-surface/50 px-6 py-10 text-sm text-black/55">
        No audit entries for <strong>{asset.assetName}</strong> yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6">
      <h3 className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-black/45">
        Movement timeline · {asset.assetName}
      </h3>
      <p className="mt-1 text-xs text-black/50">
        {timeline.length} event{timeline.length === 1 ? "" : "s"} · {asset.status.label}
      </p>
      <ol className="relative mt-5 space-y-0 border-l-2 border-brand/25 pl-6">
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
  );
}

type Props = {
  auditAccess?: boolean;
};

export function AssetLifecycleSection({ auditAccess = true }: Props) {
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [pickerQuery, setPickerQuery] = useState("");
  const [assetId, setAssetId] = useState("");
  const [timeline, setTimeline] = useState<AuditRow[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clubMode = Boolean(clubId);

  useEffect(() => {
    void fetch("/api/clubs")
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setClubs(Array.isArray(list) ? list : []))
      .catch(() => setClubs([]));
  }, []);

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const params = new URLSearchParams();
      if (clubId) params.set("clubId", clubId);
      if (!clubId && pickerQuery.trim()) params.set("q", pickerQuery.trim());
      const qs = params.toString();
      const res = await fetch(
        `/api/reports/lifecycle-assets${qs ? `?${qs}` : ""}`
      );
      const j = await res.json();
      const list = (j.assets ?? []) as PickerAsset[];
      setAssets(Array.isArray(list) ? list : []);
    } catch {
      setAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  }, [clubId, pickerQuery]);

  useEffect(() => {
    const delay = !clubId && pickerQuery.trim() ? 300 : 0;
    const t = window.setTimeout(() => void loadAssets(), delay);
    return () => window.clearTimeout(t);
  }, [loadAssets, clubId, pickerQuery]);

  const loadTimeline = useCallback(
    async (id: string) => {
      if (!id || !auditAccess) {
        setTimeline([]);
        setLoadingLog(false);
        return;
      }
      setLoadingLog(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/audit-logs?assetId=${encodeURIComponent(id)}&limit=200`
        );
        if (!res.ok) throw new Error("Could not load history");
        const j = await res.json();
        const items = (j.items ?? []) as AuditRow[];
        setTimeline(
          [...items].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
        setTimeline([]);
      } finally {
        setLoadingLog(false);
      }
    },
    [auditAccess]
  );

  useEffect(() => {
    loadTimeline(assetId).catch(console.error);
  }, [assetId, loadTimeline]);

  const selected = useMemo(
    () => assets.find((a) => a.id === assetId),
    [assets, assetId]
  );

  const selectedClubName = clubs.find((c) => c.id === clubId)?.name ?? null;

  const clubActiveAssets = useMemo(
    () =>
      clubId
        ? assets
            .filter((a) => a.status.code !== "written_off")
            .sort((a, b) => a.assetName.localeCompare(b.assetName))
        : [],
    [assets, clubId]
  );

  const clubRetiredAssets = useMemo(
    () =>
      clubId
        ? assets
            .filter((a) => a.status.code === "written_off")
            .sort((a, b) => a.assetName.localeCompare(b.assetName))
        : [],
    [assets, clubId]
  );

  const pickerOptions = useMemo(() => {
    if (clubMode) return [];
    return assets
      .filter((a) => matchesAssetSearch(a, pickerQuery) || a.id === assetId)
      .sort((a, b) =>
        a.assetName.localeCompare(b.assetName, undefined, { sensitivity: "base" })
      );
  }, [assets, pickerQuery, assetId, clubMode]);

  return (
    <section id="lifecycle" className="section-card scroll-mt-6 overflow-hidden">
      <div className="border-b border-brand/10 bg-gradient-to-r from-brand-muted/80 to-white px-6 py-5 sm:px-8">
        <p className="page-eyebrow">Club &amp; asset history</p>
        <h2 className="font-heading mt-1 text-lg font-bold uppercase tracking-wide text-black">
          Asset lifecycle / movement
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/65">
          {clubMode ? (
            <>
              Viewing <strong>{selectedClubName}</strong> — active assignments
              and written-off units are shown separately. Click any unit for its
              full audit trail (including replacement requests on write-off).
            </>
          ) : (
            <>
              Pick a <strong>club</strong> for a site overview (what is deployed
              vs what was written off), or search individual assets below.
            </>
          )}
        </p>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        <div className="max-w-md">
          <label htmlFor="lifecycle-club" className="text-xs font-medium text-black/70">
            Club
          </label>
          <select
            id="lifecycle-club"
            value={clubId}
            onChange={(e) => {
              setClubId(e.target.value);
              setAssetId("");
            }}
            className="input-field mt-1 px-3 py-2.5 text-sm"
          >
            <option value="">— Search by asset (no club selected) —</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {loadingAssets ? (
          <p className="text-sm text-black/55">Loading hardware…</p>
        ) : clubMode ? (
          <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-2">
              <ClubStageBlock
                title="Currently assigned"
                subtitle="Units linked to this club today — deployed, in assessment, repairs, etc."
                assets={clubActiveAssets}
                selectedId={assetId}
                onSelect={setAssetId}
                variant="active"
                emptyMessage="No active hardware is currently linked to this club."
              />
              <ClubStageBlock
                title="Written off / retired"
                subtitle="Former club hardware — includes units where replacement was requested on the write-off form."
                assets={clubRetiredAssets}
                selectedId={assetId}
                onSelect={setAssetId}
                variant="retired"
                emptyMessage="No written-off units on record for this club."
              />
            </div>

            <TimelinePanel
              asset={selected}
              timeline={timeline}
              loading={loadingLog}
              auditAccess={auditAccess}
            />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="lifecycle-asset-search"
                  className="text-xs font-medium text-black/70"
                >
                  Search assets
                </label>
                <input
                  id="lifecycle-asset-search"
                  type="search"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Name, club, serial…"
                  className="input-field mt-1 px-3 py-2.5 text-sm"
                />
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
                  className="input-field mt-1 px-3 py-2.5 text-sm"
                >
                  <option value="">— Choose an asset —</option>
                  {pickerOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {assetPickerLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <TimelinePanel
              asset={selected}
              timeline={timeline}
              loading={loadingLog}
              auditAccess={auditAccess}
            />
          </div>
        )}
      </div>
    </section>
  );
}
