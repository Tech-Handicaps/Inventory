"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BoardSkeleton } from "@/components/Skeleton";
import { EditAssetModal } from "@/components/EditAssetModal";
import { HardwareCaptureForm } from "@/components/HardwareCaptureForm";
import { LogRepairModal } from "@/components/LogRepairModal";
import { StartAssessmentModal } from "@/components/StartAssessmentModal";
import { useToast } from "@/components/ToastProvider";
import { WriteOffModal } from "@/components/WriteOffModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetTagChips } from "@/components/ui/AssetTagChips";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { matchesAssetSearch } from "@/lib/inventory/asset-search";
import {
  displayAssetManufacturer,
  displayAssetModel,
} from "@/lib/inventory/asset-hardware-display";
import { formatGeoLabel } from "@/lib/geo/region-display";
import { displayDeviceTemplateLabel } from "@/lib/inventory/device-template-label";
import { HARDWARE_BOARD_STATUS_MOVES } from "@/lib/inventory/hardware-board-moves";

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
  tags?: string[] | null;
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
  deviceTemplate?: {
    id: string;
    label: string;
    manufacturer?: string | null;
    model?: string | null;
  } | null;
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
  const allowed = HARDWARE_BOARD_STATUS_MOVES[asset.status.code];
  return statuses.filter((s) => {
    if (allowed && !allowed.includes(s.code)) return false;
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${cfg.ring} ${cfg.bg} ${cfg.fg}`}
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
  refurbished: "border-t-[#2f7a3c] bg-emerald-50/80",
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
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.showError(
          typeof j.error === "string" ? j.error : "Delete failed"
        );
        return;
      }
      setPendingDelete(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, load, toast]);

  if (loading) {
    return <BoardSkeleton />;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
        <PageHeader
          title="Hardware board"
          description="Move hardware through each lifecycle stage."
          help={
            <>
              Each column is a lifecycle stage. Use <strong>Register hardware</strong>{" "}
              (template + serial), then move cards by changing status.{" "}
              <strong>Deployed</strong> field returns flow through{" "}
              <strong>Assessment/Maintenance</strong> before <strong>In repairs</strong>{" "}
              when a formal repair record is needed. <strong>New Stock</strong> and{" "}
              <strong>Refurbished</strong> are the distributable stages; the dashboard
              rolls both into <strong>Available to distribute</strong>. Templates and
              clubs are managed in <strong>Settings</strong>.
            </>
          }
        />
        <HardwareCaptureForm
          statuses={effectiveStatuses}
          onCreated={() => void load()}
        />

        {fetchError ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
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

        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <h2 className="font-heading text-sm font-bold text-ink shrink-0">
              Stock & workflow
            </h2>
            <div className="min-w-0 flex-1 max-w-2xl">
              <label className="block">
                <span className="text-xs font-semibold text-muted">
                  Search entire board
                </span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="search"
                    enterKeyHint="search"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    placeholder="Name, club, serial, template, category, location, IP…"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ring-brand/30 focus:border-brand/50 focus:ring-2"
                    autoComplete="off"
                  />
                  {globalSearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => setGlobalSearch("")}
                      className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-black/[0.04]"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </label>
              <p className="mt-1.5 text-xs text-muted">
                Narrows cards in every stage at once (including written-off below). Combine with{" "}
                <strong className="text-muted">each column&apos;s filter</strong> for the last
                bit of narrowing.
              </p>
            </div>
          </div>
          {globalSearch.trim() &&
          assets.length > 0 &&
          globallyFilteredAssets.length === 0 ? (
            <div
              className="mb-4 rounded-lg border border-line bg-black/[0.03] px-3 py-2 text-sm text-ink"
              role="status"
            >
              No hardware matches your board search.{" "}
              <button
                type="button"
                onClick={() => setGlobalSearch("")}
                className="font-semibold text-brand-deep hover:underline"
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
                className={`flex max-h-[min(70vh,720px)] flex-col rounded-lg border border-line border-t-4 bg-white ${
                  columnAccent[st.code] ?? "border-t-neutral-400 bg-white"
                }`}
              >
                <div className="border-b border-line px-4 py-3">
                  <h3 className="font-heading font-bold text-ink">
                    {st.label}
                  </h3>
                  {st.description ? (
                    <p className="mt-1 text-xs text-muted">
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
                      className="w-full rounded-md border border-line bg-white px-2 py-2 text-xs outline-none placeholder:text-muted ring-brand/25 focus:border-brand/40 focus:ring-2"
                      autoComplete="off"
                      aria-label={`Filter ${st.label} column`}
                    />
                  </label>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
                    {displayed.length}
                  </p>
                  {(globalSearch.trim() || colRaw.trim()) &&
                  fullStageCount !== displayed.length ? (
                    <p className="mt-1 text-xs font-medium text-muted">
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
                        onDelete={() => setPendingDelete(asset)}
                      />
                    </li>
                  ))}
                  {displayed.length === 0 && (
                    <li className="rounded-lg border border-dashed border-line py-8 text-center text-sm text-muted">
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
            <h2 className="font-heading mb-4 text-sm font-bold text-ink">
              {writtenOff.label}
            </h2>
            <div
              className={`overflow-hidden rounded-lg border border-line border-t-4 ${columnAccent.written_off}`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-white text-left">
                      <th className="px-4 py-3 font-medium">Club name</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Tags</th>
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
                        className="border-b border-line"
                      >
                        <td className="px-4 py-2 text-ink">
                          {asset.club?.name ?? "—"}
                        </td>
                        <td className="px-4 py-2">{asset.assetName}</td>
                        <td className="px-4 py-2">
                          <AssetTagChips
                            tags={asset.tags}
                            category={asset.category}
                            size="xs"
                          />
                        </td>
                        <td className="px-4 py-2">
                          {displayAssetManufacturer(asset) ?? "—"}
                        </td>
                        <td className="px-4 py-2">{displayAssetModel(asset) ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {asset.serialNumber ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-muted">
                          {asset.reason ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <a
                            href={`/api/assets/${asset.id}/write-off-certificate`}
                            className="text-xs font-semibold text-brand-deep hover:underline"
                            title="Download write-off certificate (PDF)"
                          >
                            Download PDF
                          </a>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="w-full max-w-[200px] rounded border border-line bg-white px-2 py-1 text-xs"
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
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(asset.id)}
                              className="text-xs font-semibold text-brand-deep hover:underline"
                            >
                              Edit
                            </button>
                            <OverflowMenu
                              label={asset.assetName}
                              items={[
                                {
                                  label: "Delete",
                                  destructive: true,
                                  onSelect: () => setPendingDelete(asset),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {writtenOffRows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted">
                    {writtenOffStageTotal === 0 ? (
                      "No written-off hardware."
                    ) : globalSearch.trim() ? (
                      <>
                        No written-off rows match board search —{" "}
                        <button
                          type="button"
                          className="font-semibold text-brand-deep hover:underline"
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
            onClose={() => {
              setEditingId(null);
              void load();
            }}
            onSaved={() => {
              setEditingId(null);
              void load();
            }}
          />
        ) : null}

        <ConfirmDeleteDialog
          open={pendingDelete !== null}
          title="Delete asset?"
          itemName={pendingDelete?.assetName ?? ""}
          itemDetail={pendingDelete?.serialNumber ? `S/N ${pendingDelete.serialNumber}` : "No serial number"}
          consequence="This removes the asset from the register. It cannot be undone."
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      </main>
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
    <article className="rounded-lg border border-line bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading font-semibold text-ink">
              {asset.assetName}
            </p>
            {asset.status.code === "assessment" ? (
              <>
                {intake ? (
                  <>
                    <AssessmentWorkflowPill
                      workflowStatus={intake.workflowStatus}
                    />
                    <span className="rounded border border-line bg-black/[0.04] px-1.5 py-0.5 font-mono text-xs font-semibold text-ink">
                      {intake.referenceNumber}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-amber-800">
                    No open intake link
                  </span>
                )}
              </>
            ) : null}
            {asset.club ? (
              <span className="rounded border border-brand/40 bg-brand-muted/60 px-1.5 py-0.5 text-xs font-bold text-brand-deep">
                {asset.club.name}
              </span>
            ) : null}
            {asset.dataSource === "zoho_assist" ? (
              <span className="rounded border border-brand/30 bg-brand-muted px-1.5 py-0.5 text-xs font-bold text-brand-deep">
                Assist
              </span>
            ) : null}
          </div>
          {asset.deviceTemplate ? (
            <p className="text-xs font-medium text-brand-deep">
              Template: {displayDeviceTemplateLabel(asset.deviceTemplate)}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <AssetTagChips tags={asset.tags} category={asset.category} size="xs" />
          </div>
          {(displayAssetManufacturer(asset) || displayAssetModel(asset)) ? (
            <p className="mt-1 text-xs text-muted">
              {[displayAssetManufacturer(asset), displayAssetModel(asset)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {asset.deviceLocation ? (
            <p className="mt-1 text-xs text-muted">
              <span className="font-medium text-muted">Location:</span>{" "}
              {asset.deviceLocation}
            </p>
          ) : null}
          {asset.publicIp || asset.geoCountryCode ? (
            <p className="mt-1 text-xs text-muted">
              <span className="font-medium text-muted">Public IP:</span>{" "}
              <span className="font-mono text-xs">
                {asset.publicIp ?? "—"}
              </span>
              {geoLabel !== "—" ? (
                <span className="mt-0.5 block text-xs text-muted">
                  {geoLabel}
                </span>
              ) : null}
            </p>
          ) : null}
          {asset.serialNumber ? (
            <p className="mt-1 font-mono text-xs text-muted">
              S/N {asset.serialNumber}
            </p>
          ) : null}
          {asset.processorName || asset.systemRam || asset.systemGpu ? (
            <dl className="mt-2 space-y-0.5 border-t border-line pt-2 text-xs text-ink">
              {asset.processorName ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted">CPU</dt>
                  <dd className="min-w-0">{asset.processorName}</dd>
                </div>
              ) : null}
              {asset.systemRam ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted">RAM</dt>
                  <dd>{asset.systemRam}</dd>
                </div>
              ) : null}
              {asset.systemGpu ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted">GPU</dt>
                  <dd className="min-w-0">{asset.systemGpu}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {asset.zohoAssistDeviceId ? (
            <p className="mt-1 font-mono text-xs text-muted">
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
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              disabled={disabled}
              onClick={onEdit}
              className="font-semibold text-brand-deep hover:underline disabled:opacity-50"
            >
              Edit
            </button>
            <OverflowMenu
              label={asset.assetName}
              disabled={disabled}
              items={[{ label: "Delete", destructive: true, onSelect: onDelete }]}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {asset.status.code === "deployed" && onStartAssessment ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onStartAssessment}
            className="font-heading w-full rounded-md border-2 border-amber-500/90 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            Send for Assessment/Maintenance
          </button>
        ) : null}
        {asset.status.code !== "deployed" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onLogRepair}
            className="font-heading w-full rounded-md border-2 border-orange-500/80 bg-orange-50 px-2 py-1.5 text-xs font-bold text-orange-900 transition-colors hover:bg-orange-100 disabled:opacity-50"
          >
            Log repair
          </button>
        ) : null}
        {asset.status.code === "assessment" && onCancelAssessment ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onCancelAssessment}
            className="w-full rounded-md border border-red-400/70 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
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
            className="w-full rounded-md border-2 border-neutral-500/80 bg-neutral-100 px-2 py-1.5 text-xs font-bold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-50"
          >
            Write off (cannot repair)
          </button>
        ) : null}
        <div>
          <label className="block text-xs font-medium text-muted">
            Move to
          </label>
          <select
            className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs"
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
