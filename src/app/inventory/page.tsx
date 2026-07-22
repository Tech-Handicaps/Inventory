"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditAssetModal } from "@/components/EditAssetModal";
import { HardwareCaptureForm } from "@/components/HardwareCaptureForm";
import { InventoryHeader } from "@/components/InventoryHeader";
import { LogRepairModal } from "@/components/LogRepairModal";
import { StartAssessmentModal } from "@/components/StartAssessmentModal";
import { useToast } from "@/components/ToastProvider";
import { WriteOffModal } from "@/components/WriteOffModal";
import { matchesAssetSearch } from "@/lib/inventory/asset-search";
import { formatGeoLabel } from "@/lib/geo/region-display";

type Status = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

type OpenAssessmentBrief = {
  id: string;
  referenceNumber: string;
  workflowStatus: string;
};

type Asset = {
  id: string;
  assetName: string;
  category: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  reason: string | null;
  dateUpdated: string;
  dataSource: string;
  zohoAssistDeviceId: string | null;
  deviceLocation: string | null;
  processorName: string | null;
  systemRam: string | null;
  systemGpu: string | null;
  lastSyncedFromAssistAt: string | null;
  publicIp: string | null;
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  status: Status;
  deviceTemplate?: { id: string; label: string } | null;
  club?: { id: string; name: string } | null;
  /** Open assessments for this asset (API returns at most one when workflowStatus is open). */
  assessments?: OpenAssessmentBrief[];
};

const PRIMARY_ORDER = [
  "new_stock",
  "deployed",
  "assessment",
  "repair",
  "refurbished",
] as const;

function openAssessment(asset: Asset): OpenAssessmentBrief | null {
  const row = asset.assessments?.[0];
  return row ?? null;
}

/** Hide invalid lifecycle shortcuts (server also enforces transitions). */
function statusesForMoves(statuses: Status[], asset: Asset): Status[] {
  return statuses.filter((s) => {
    if (asset.status.code === "deployed" && s.code === "repair") return false;
    if (asset.status.code === "assessment" && s.code === "repair") return false;
    if (
      (asset.status.code === "assessment" || asset.status.code === "repair") &&
      s.code === "written_off"
    ) {
      return false;
    }
    return true;
  });
}

function AssessmentWorkflowPill({ workflowStatus }: { workflowStatus: string }) {
  const norm = workflowStatus.trim().toLowerCase();
  const cfg =
    norm === "completed"
      ? {
          label: "Completed",
          ring: "ring-emerald-500/35",
          dot: "bg-emerald-500",
          fg: "text-emerald-950",
          bg: "bg-emerald-50",
        }
      : norm === "cancelled"
        ? {
            label: "Cancelled",
            ring: "ring-red-500/35",
            dot: "bg-red-600",
            fg: "text-red-950",
            bg: "bg-red-50",
          }
        : {
            label: "Open",
            ring: "ring-amber-400/45",
            dot: "bg-amber-400",
            fg: "text-amber-950",
            bg: "bg-amber-50",
          };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${cfg.ring} ${cfg.bg} ${cfg.fg}`}
      title="Assessment/Maintenance intake status"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

/** When GET /api/statuses fails, columns still render using status embedded on each asset. */
function deriveStatusesFromAssets(assets: Asset[]): Status[] {
  const map = new Map<string, Status>();
  for (const a of assets) {
    if (a.status && !map.has(a.status.id)) {
      map.set(a.status.id, a.status);
    }
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Brand-aligned columns: greens flag the distributable stages (New Stock, Refurbished). */
const columnAccent: Record<string, string> = {
  new_stock: "border-t-brand bg-brand-muted",
  deployed: "border-t-sky-500 bg-sky-50/90",
  assessment: "border-t-amber-500 bg-amber-50/90",
  repair: "border-t-orange-500 bg-orange-50/90",
  refurbished: "border-t-[#0b5d2e] bg-emerald-50/80",
  written_off: "border-t-neutral-400 bg-neutral-100",
};

export default function InventoryPage() {
  const toast = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusesFallback, setStatusesFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [repairAsset, setRepairAsset] = useState<Asset | null>(null);
  const [repairAssessment, setRepairAssessment] = useState<{
    id: string;
    referenceNumber: string;
  } | null>(null);
  const [writeOffAsset, setWriteOffAsset] = useState<Asset | null>(null);
  const [writeOffAssessment, setWriteOffAssessment] = useState<{
    id: string;
    referenceNumber: string;
  } | null>(null);
  const [assessAsset, setAssessAsset] = useState<Asset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnSearchByStatusId, setColumnSearchByStatusId] = useState<
    Record<string, string>
  >({});

  const load = useCallback(async () => {
    setFetchError(null);
    setStatusesFallback(false);
    const [aRes, sRes] = await Promise.all([
      fetch("/api/assets?limit=500"),
      fetch("/api/statuses"),
    ]);

    if (!aRes.ok) {
      const j = (await aRes.json().catch(() => ({}))) as { error?: string };
      setAssets([]);
      setStatuses([]);
      setFetchError(
        aRes.status === 403
          ? "You don’t have permission to load assets (hardware board needs an admin or operations role). Use Dashboard / Reports if you only have reports access."
          : typeof j.error === "string"
            ? j.error
            : `Could not load assets (${aRes.status}).`
      );
      return;
    }

    const aJson = (await aRes.json()) as { assets?: Asset[] };
    setAssets(Array.isArray(aJson.assets) ? aJson.assets : []);

    if (!sRes.ok) {
      const j = (await sRes.json().catch(() => ({}))) as { error?: string };
      setStatuses([]);
      setStatusesFallback(true);
      setFetchError(
        sRes.status === 403
          ? "Lifecycle statuses were blocked (403). Columns below are derived from your assets so cards still appear."
          : typeof j.error === "string"
            ? `Lifecycle statuses: ${j.error}. Columns are derived from loaded assets.`
            : `Could not load statuses (${sRes.status}); columns derived from assets.`
      );
      return;
    }

    const sJson = await sRes.json();
    setStatuses(Array.isArray(sJson) ? (sJson as Status[]) : []);
  }, []);

  useEffect(() => {
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  const effectiveStatuses = useMemo((): Status[] => {
    if (statuses.length > 0) return statuses;
    return deriveStatusesFromAssets(assets);
  }, [statuses, assets]);

  const globallyFilteredAssets = useMemo(() => {
    return assets.filter((a) => matchesAssetSearch(a, globalSearch));
  }, [assets, globalSearch]);

  const byStatus = useMemo(() => {
    const m = new Map<string, Asset[]>();
    for (const s of effectiveStatuses) m.set(s.id, []);
    for (const asset of globallyFilteredAssets) {
      const list = m.get(asset.status.id);
      if (list) list.push(asset);
      else m.set(asset.status.id, [asset]);
    }
    return m;
  }, [globallyFilteredAssets, effectiveStatuses]);

  const byStatusUnfilteredCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of effectiveStatuses) m.set(s.id, 0);
    for (const asset of assets) {
      m.set(asset.status.id, (m.get(asset.status.id) ?? 0) + 1);
    }
    return m;
  }, [assets, effectiveStatuses]);

  const orderedPrimary = useMemo(() => {
    const map = new Map(effectiveStatuses.map((s) => [s.code, s]));
    return PRIMARY_ORDER.map((code) => map.get(code)).filter(
      (s): s is Status => Boolean(s)
    );
  }, [effectiveStatuses]);

  const writtenOff = useMemo(
    () => effectiveStatuses.find((s) => s.code === "written_off"),
    [effectiveStatuses]
  );

  const writtenOffRows = useMemo(() => {
    if (!writtenOff) return [];
    return byStatus.get(writtenOff.id) ?? [];
  }, [writtenOff, byStatus]);

  const writtenOffStageTotal = useMemo(() => {
    if (!writtenOff) return 0;
    return assets.filter((a) => a.status.id === writtenOff.id).length;
  }, [writtenOff, assets]);

  async function updateAssetStatus(assetId: string, statusId: string) {
    setSavingId(assetId);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof j.error === "string" ? j.error : "Update failed"
        );
      }
      const updated = (await res.json()) as Asset;
      setAssets((prev) =>
        prev.map((x) =>
          x.id === assetId
            ? {
                ...x,
                ...updated,
                status: updated.status as Status,
              }
            : x
        )
      );
    } catch (e) {
      console.error(e);
      toast.showError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  }

  async function cancelOpenAssessment(asset: Asset) {
    const o = openAssessment(asset);
    if (!o) {
      toast.showError(
        "No open Assessment/Maintenance intake is linked on this card. Refresh if this looks wrong."
      );
      return;
    }
    if (
      !window.confirm(
        `Cancel Assessment/Maintenance intake (${o.referenceNumber})? The unit moves back to Deployed unless you change stage again.`
      )
    ) {
      return;
    }
    setSavingId(asset.id);
    try {
      const res = await fetch(`/api/assessments/${encodeURIComponent(o.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Cancel failed");
      }
      await load();
    } catch (e) {
      console.error(e);
      toast.showError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setSavingId(null);
    }
  }

  const removeAsset = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`Delete “${name}”? This cannot be undone.`)) return;
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.showError(
          typeof j.error === "string" ? j.error : "Delete failed"
        );
        return;
      }
      await load();
    },
    [load, toast]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-black/55">Loading hardware inventory…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="inventory" />

      <main className="mx-auto max-w-7xl space-y-8 p-6">
        <HardwareCaptureForm
          statuses={effectiveStatuses}
          onCreated={() => void load()}
        />

        {fetchError ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">{fetchError}</p>
            {statusesFallback && assets.length > 0 ? (
              <p className="mt-2 text-amber-900/90">
                Your devices are still listed below using stage data stored on each asset.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            How this board is organized
          </h2>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-black/70">
            Each column is a lifecycle stage for hardware. Use{" "}
            <strong>Register hardware</strong> above (template + serial), then
            move cards by changing status. <strong>Deployed</strong> field returns flow
            through <strong>Assessment/Maintenance</strong> (triage or light depot work such as reloads){" "}
            before <strong>In repairs</strong> when a formal repair record is needed. The two
            <strong> distributable</strong> stages are <strong>New Stock</strong> (never deployed) and{" "}
            <strong>Refurbished</strong> (serviced, ready for reuse); the dashboard rolls both into{" "}
            <strong>Available to distribute</strong>. Use{" "}
            <strong>Settings → Device templates</strong> for reusable make/model
            presets and <strong>Settings → Clubs</strong> for club/site labels on each unit.
            Status codes live in the database so you can extend stages
            later without losing data.
          </p>
        </div>

        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <h2 className="font-heading text-sm font-bold uppercase tracking-[0.15em] text-black shrink-0">
              Stock & workflow
            </h2>
            <div className="min-w-0 flex-1 max-w-2xl">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-black/50">
                  Search entire board
                </span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="search"
                    enterKeyHint="search"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    placeholder="Name, club, serial, template, category, location, IP…"
                    className="min-w-0 flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-brand/30 focus:border-brand/50 focus:ring-2"
                    autoComplete="off"
                  />
                  {globalSearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => setGlobalSearch("")}
                      className="shrink-0 rounded-lg border border-black/15 px-3 py-2 text-xs font-medium text-black/70 hover:bg-black/[0.04]"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </label>
              <p className="mt-1.5 text-[11px] text-black/45">
                Narrows cards in every stage at once (including written-off below). Combine with{" "}
                <strong className="text-black/55">each column&apos;s filter</strong> for the last
                bit of narrowing.
              </p>
            </div>
          </div>
          {globalSearch.trim() &&
          assets.length > 0 &&
          globallyFilteredAssets.length === 0 ? (
            <div
              className="mb-4 rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 text-sm text-black/75"
              role="status"
            >
              No hardware matches your board search.{" "}
              <button
                type="button"
                onClick={() => setGlobalSearch("")}
                className="font-semibold text-brand hover:underline"
              >
                Clear search
              </button>{" "}
              to see all cards again.
            </div>
          ) : null}
          {!fetchError && assets.length > 0 && orderedPrimary.length === 0 ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              No matching lifecycle columns for these assets. Check Settings or re-run{" "}
              <code className="rounded bg-black/5 px-1">npm run db:seed</code> so status codes
              (new_stock, deployed, …) exist.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orderedPrimary.map((st) => {
              const bucket = byStatus.get(st.id) ?? [];
              const colRaw = columnSearchByStatusId[st.id] ?? "";
              const displayed = colRaw.trim()
                ? bucket.filter((a) => matchesAssetSearch(a, colRaw))
                : bucket;
              const fullStageCount =
                byStatusUnfilteredCount.get(st.id) ?? 0;

              let emptyHint = "";
              if (displayed.length === 0) {
                if (fullStageCount === 0)
                  emptyHint = "Nothing in this stage.";
                else if (
                  bucket.length === 0 &&
                  globalSearch.trim()
                )
                  emptyHint =
                    "No cards here match board search.";
                else if (bucket.length > 0 && colRaw.trim())
                  emptyHint =
                    "No matches for this column filter — try different words.";
                else emptyHint = "Nothing in this stage.";
              }

              return (
              <div
                key={st.id}
                className={`flex max-h-[min(70vh,720px)] flex-col rounded-xl border border-black/10 border-t-4 bg-white shadow-sm ${
                  columnAccent[st.code] ?? "border-t-neutral-400 bg-white"
                }`}
              >
                <div className="border-b border-black/10 px-4 py-3">
                  <h3 className="font-heading font-bold uppercase tracking-wide text-black">
                    {st.label}
                  </h3>
                  {st.description ? (
                    <p className="mt-1 text-xs text-black/55">
                      {st.description}
                    </p>
                  ) : null}
                  <label className="mt-3 block">
                    <span className="sr-only">Filter assets in {st.label}</span>
                    <input
                      type="search"
                      enterKeyHint="search"
                      value={colRaw}
                      onChange={(e) =>
                        setColumnSearchByStatusId((prev) => ({
                          ...prev,
                          [st.id]: e.target.value,
                        }))
                      }
                      placeholder="Search this column…"
                      className="w-full rounded-md border border-black/15 bg-white px-2 py-2 text-xs outline-none placeholder:text-black/35 ring-brand/25 focus:border-brand/40 focus:ring-2"
                      autoComplete="off"
                      aria-label={`Filter ${st.label} column`}
                    />
                  </label>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-black">
                    {displayed.length}
                  </p>
                  {(globalSearch.trim() || colRaw.trim()) &&
                  fullStageCount !== displayed.length ? (
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-black/45">
                      {fullStageCount} in stage · {displayed.length} matching
                    </p>
                  ) : null}
                </div>
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {displayed.map((asset) => (
                    <li key={asset.id}>
                      <HardwareCard
                        asset={asset}
                        statuses={effectiveStatuses}
                        disabled={savingId === asset.id}
                        onStatusChange={updateAssetStatus}
                        onStartAssessment={
                          asset.status.code === "deployed"
                            ? () => setAssessAsset(asset)
                            : undefined
                        }
                        onLogRepair={() => {
                          setRepairAsset(asset);
                          const o = openAssessment(asset);
                          if (asset.status.code === "assessment" && o) {
                            setRepairAssessment({
                              id: o.id,
                              referenceNumber: o.referenceNumber,
                            });
                          } else {
                            setRepairAssessment(null);
                          }
                        }}
                        onCancelAssessment={
                          asset.status.code === "assessment"
                            ? () => void cancelOpenAssessment(asset)
                            : undefined
                        }
                        onWriteOff={() => {
                          setWriteOffAsset(asset);
                          const o = openAssessment(asset);
                          if (asset.status.code === "assessment" && o) {
                            setWriteOffAssessment({
                              id: o.id,
                              referenceNumber: o.referenceNumber,
                            });
                          } else {
                            setWriteOffAssessment(null);
                          }
                        }}
                        onEdit={() => setEditingId(asset.id)}
                        onDelete={() => void removeAsset(asset.id, asset.assetName)}
                      />
                    </li>
                  ))}
                  {displayed.length === 0 && (
                    <li className="rounded-lg border border-dashed border-black/15 py-8 text-center text-sm text-black/40">
                      {emptyHint}
                    </li>
                  )}
                </ul>
              </div>
              );
            })}
          </div>
        </section>

        {writtenOff && (
          <section>
            <h2 className="font-heading mb-4 text-sm font-bold uppercase tracking-[0.15em] text-black">
              {writtenOff.label}
            </h2>
            <div
              className={`overflow-hidden rounded-xl border border-black/10 border-t-4 shadow-sm ${columnAccent.written_off}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 bg-white/80 text-left">
                      <th className="px-4 py-3 font-medium">Club name</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Manufacturer</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Serial</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Certificate</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {writtenOffRows.map((asset) => (
                      <tr
                        key={asset.id}
                        className="border-b border-black/5"
                      >
                        <td className="px-4 py-2 text-black/80">
                          {asset.club?.name ?? "—"}
                        </td>
                        <td className="px-4 py-2">{asset.assetName}</td>
                        <td className="px-4 py-2">{asset.category}</td>
                        <td className="px-4 py-2">
                          {asset.manufacturer ?? "—"}
                        </td>
                        <td className="px-4 py-2">{asset.model ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {asset.serialNumber ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-black/65">
                          {asset.reason ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <a
                            href={`/api/assets/${asset.id}/write-off-certificate`}
                            className="text-xs font-semibold text-brand hover:underline"
                            title="Download write-off certificate (PDF)"
                          >
                            Download PDF
                          </a>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="w-full max-w-[200px] rounded border border-black/15 bg-white px-2 py-1 text-xs"
                            value={asset.status.id}
                            disabled={savingId === asset.id}
                            onChange={(e) =>
                              updateAssetStatus(asset.id, e.target.value)
                            }
                          >
                            {effectiveStatuses.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingId(asset.id)}
                            className="text-xs font-semibold text-brand hover:underline"
                          >
                            Edit
                          </button>
                          <span className="mx-1.5 text-black/25" aria-hidden>
                            ·
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void removeAsset(asset.id, asset.assetName)
                            }
                            className="text-xs font-semibold text-red-700 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {writtenOffRows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-black/45">
                    {writtenOffStageTotal === 0 ? (
                      "No written-off hardware."
                    ) : globalSearch.trim() ? (
                      <>
                        No written-off rows match board search —{" "}
                        <button
                          type="button"
                          className="font-semibold text-brand hover:underline"
                          onClick={() => setGlobalSearch("")}
                        >
                          Clear board search
                        </button>
                        .
                      </>
                    ) : (
                      "No written-off hardware."
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}
        <StartAssessmentModal
          asset={assessAsset}
          onClose={() => setAssessAsset(null)}
          onSuccess={() => void load()}
        />
        <LogRepairModal
          asset={repairAsset}
          assessmentId={repairAssessment?.id}
          assessmentReference={repairAssessment?.referenceNumber}
          onClose={() => {
            setRepairAsset(null);
            setRepairAssessment(null);
          }}
          onSuccess={() => void load()}
        />
        <WriteOffModal
          asset={writeOffAsset}
          assessmentId={writeOffAssessment?.id}
          assessmentReference={writeOffAssessment?.referenceNumber}
          onClose={() => {
            setWriteOffAsset(null);
            setWriteOffAssessment(null);
          }}
          onSuccess={() => void load()}
        />

        {editingId ? (
          <EditAssetModal
            assetId={editingId}
            statuses={effectiveStatuses.map((s) => ({
              id: s.id,
              code: s.code,
              label: s.label,
            }))}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              void load();
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function HardwareCard({
  asset,
  statuses,
  disabled,
  onStatusChange,
  onStartAssessment,
  onLogRepair,
  onWriteOff,
  onCancelAssessment,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  statuses: Status[];
  disabled: boolean;
  onStatusChange: (id: string, statusId: string) => void;
  onStartAssessment?: () => void;
  onLogRepair: () => void;
  onWriteOff?: () => void;
  onCancelAssessment?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const geoLabel = formatGeoLabel(
    asset.geoCountryCode,
    asset.geoRegionCode,
    asset.geoCity,
    asset.geoRegionName
  );

  const intake = openAssessment(asset);

  return (
    <article className="rounded-lg border border-black/10 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading font-semibold text-black">
              {asset.assetName}
            </p>
            {asset.status.code === "assessment" ? (
              <>
                {intake ? (
                  <>
                    <AssessmentWorkflowPill
                      workflowStatus={intake.workflowStatus}
                    />
                    <span className="rounded border border-black/15 bg-black/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-black/75">
                      {intake.referenceNumber}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-semibold uppercase text-amber-800">
                    No open intake link
                  </span>
                )}
              </>
            ) : null}
            {asset.club ? (
              <span className="rounded border border-brand/40 bg-brand-muted/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                {asset.club.name}
              </span>
            ) : null}
            {asset.dataSource === "zoho_assist" ? (
              <span className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-900">
                Assist
              </span>
            ) : null}
          </div>
          {asset.deviceTemplate ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-brand">
              Template: {asset.deviceTemplate.label}
            </p>
          ) : null}
          <p className="text-xs text-black/55">
            {asset.category}
            {asset.manufacturer || asset.model
              ? ` · ${[asset.manufacturer, asset.model].filter(Boolean).join(" ")}`
              : ""}
          </p>
          {asset.deviceLocation ? (
            <p className="mt-1 text-xs text-black/60">
              <span className="font-medium text-black/45">Location:</span>{" "}
              {asset.deviceLocation}
            </p>
          ) : null}
          {asset.publicIp || asset.geoCountryCode ? (
            <p className="mt-1 text-xs text-black/60">
              <span className="font-medium text-black/45">Public IP:</span>{" "}
              <span className="font-mono text-[11px]">
                {asset.publicIp ?? "—"}
              </span>
              {geoLabel !== "—" ? (
                <span className="mt-0.5 block text-[10px] text-black/50">
                  {geoLabel}
                </span>
              ) : null}
            </p>
          ) : null}
          {asset.serialNumber ? (
            <p className="mt-1 font-mono text-xs text-black/65">
              S/N {asset.serialNumber}
            </p>
          ) : null}
          {asset.processorName || asset.systemRam || asset.systemGpu ? (
            <dl className="mt-2 space-y-0.5 border-t border-black/5 pt-2 text-[11px] text-black/70">
              {asset.processorName ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-black/45">CPU</dt>
                  <dd className="min-w-0">{asset.processorName}</dd>
                </div>
              ) : null}
              {asset.systemRam ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-black/45">RAM</dt>
                  <dd>{asset.systemRam}</dd>
                </div>
              ) : null}
              {asset.systemGpu ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-black/45">GPU</dt>
                  <dd className="min-w-0">{asset.systemGpu}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {asset.zohoAssistDeviceId ? (
            <p className="mt-1 font-mono text-[10px] text-black/40">
              Assist id {asset.zohoAssistDeviceId}
            </p>
          ) : null}
          {asset.reason ? (
            <p className="mt-2 text-xs font-medium text-orange-700">
              {asset.reason}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              disabled={disabled}
              onClick={onEdit}
              className="font-semibold text-brand hover:underline disabled:opacity-50"
            >
              Edit
            </button>
            <span className="text-black/25" aria-hidden>
              ·
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={onDelete}
              className="font-semibold text-red-700 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {asset.status.code === "deployed" && onStartAssessment ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onStartAssessment}
            className="font-heading w-full rounded-md border-2 border-amber-500/90 bg-amber-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            Send for Assessment/Maintenance
          </button>
        ) : null}
        {asset.status.code !== "deployed" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onLogRepair}
            className="font-heading w-full rounded-md border-2 border-orange-500/80 bg-orange-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-900 transition-colors hover:bg-orange-100 disabled:opacity-50"
          >
            Log repair
          </button>
        ) : null}
        {asset.status.code === "assessment" && onCancelAssessment ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onCancelAssessment}
            className="w-full rounded-md border border-red-400/70 bg-red-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            Cancel intake
          </button>
        ) : null}
        {(asset.status.code === "assessment" ||
          asset.status.code === "repair") &&
        onWriteOff ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onWriteOff}
            className="w-full rounded-md border-2 border-neutral-500/80 bg-neutral-100 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-50"
          >
            Write off (cannot repair)
          </button>
        ) : null}
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-black/40">
            Move to
          </label>
          <select
            className="mt-1 w-full rounded-md border border-black/15 bg-surface px-2 py-1.5 text-xs"
            value={asset.status.id}
            disabled={disabled}
            onChange={(e) => onStatusChange(asset.id, e.target.value)}
          >
            {statusesForMoves(statuses, asset).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}
