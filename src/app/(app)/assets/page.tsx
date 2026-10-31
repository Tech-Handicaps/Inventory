"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TablePageSkeleton } from "@/components/Skeleton";
import { EditAssetModal } from "@/components/EditAssetModal";
import { HardwareCaptureForm } from "@/components/HardwareCaptureForm";
import { ImportAssistAssetModal } from "@/components/ImportAssistAssetModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AssetTagChips } from "@/components/ui/AssetTagChips";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { useToast } from "@/components/ToastProvider";
import { formatGeoLabel } from "@/lib/geo/region-display";
import { matchesAssetSearch } from "@/lib/inventory/asset-search";
import {
  displayAssetManufacturer,
  displayAssetModel,
} from "@/lib/inventory/asset-hardware-display";
import { displayDeviceTemplateLabel } from "@/lib/inventory/device-template-label";
import { formatDate } from "@/lib/dates/format";

type Asset = {
  id: string;
  assetName: string;
  category: string;
  tags?: string[] | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  dataSource: string;
  deviceLocation: string | null;
  processorName: string | null;
  systemRam: string | null;
  systemGpu: string | null;
  zohoAssistDeviceId: string | null;
  status: { id: string; code: string; label: string };
  deviceTemplate?: {
    id: string;
    label: string;
    manufacturer?: string | null;
    model?: string | null;
  } | null;
  club?: { id: string; name: string } | null;
  reason: string | null;
  dateAdded: string;
  dateUpdated: string;
  purchaseDate: string | null;
  warrantyEndDate: string | null;
  publicIp: string | null;
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  publicIpAssistSyncedAt: string | null;
  /** Present when API includes open assessment row (same as hardware board). */
  assessments?: { referenceNumber: string }[];
};
type Status = { id: string; code: string; label: string };

function deriveStatusesFromAssets(assets: Asset[]): Status[] {
  const map = new Map<string, Status>();
  for (const a of assets) {
    if (a.status && !map.has(a.status.id)) {
      map.set(a.status.id, a.status);
    }
  }
  return [...map.values()];
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<TablePageSkeleton label="Loading assets" />}>
      <AssetsPageContent />
    </Suspense>
  );
}

function AssetsPageContent() {
  const router = useRouter();
  const linkedAssetId = useSearchParams().get("asset");
  const toast = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assistImportOpen, setAssistImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const openAssetId = editingId ?? linkedAssetId;
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [registrySearch, setRegistrySearch] = useState("");
  const [statusFilterId, setStatusFilterId] = useState("");

  const load = useCallback(async () => {
    setFetchError(null);
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
          ? "You don’t have permission to load assets. Ask an admin to grant an operations or admin role."
          : typeof j.error === "string"
            ? j.error
            : `Could not load assets (${aRes.status}).`
      );
      return;
    }

    const a = (await aRes.json()) as { assets?: Asset[] };
    setAssets(Array.isArray(a.assets) ? a.assets : []);

    if (!sRes.ok) {
      const j = (await sRes.json().catch(() => ({}))) as { error?: string };
      setStatuses([]);
      setFetchError(
        typeof j.error === "string"
          ? `Statuses: ${j.error} (filters may be limited).`
          : `Could not load statuses (${sRes.status}).`
      );
      return;
    }

    const s = await sRes.json();
    setStatuses(Array.isArray(s) ? (s as Status[]) : []);
  }, []);

  const closeAsset = useCallback(() => {
    setEditingId(null);
    if (linkedAssetId) router.replace("/assets", { scroll: false });
    void load();
  }, [linkedAssetId, router, load]);

  const effectiveStatuses =
    statuses.length > 0 ? statuses : deriveStatusesFromAssets(assets);

  const statusesForFilter = useMemo(() => {
    return [...effectiveStatuses].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
  }, [effectiveStatuses]);

  const filteredRegistryAssets = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilterId && a.status.id !== statusFilterId) return false;
      return matchesAssetSearch(a, registrySearch);
    });
  }, [assets, registrySearch, statusFilterId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const updateStatus = useCallback(
    async (assetId: string, statusId: string) => {
      const prev = assets.find((x) => x.id === assetId);
      if (!prev || prev.status.id === statusId) return;
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
        await load();
      } catch (e) {
        console.error(e);
        toast.showError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setSavingId(null);
      }
    },
    [assets, load, toast]
  );

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
    return <TablePageSkeleton label="Loading assets" />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
        <PageHeader
          title="All assets"
          description="Every unit in one searchable table."
          help="Register hardware, assign templates and clubs, or import devices from Zoho Assist."
        >
          <button
            type="button"
            onClick={() => setAssistImportOpen(true)}
            className="btn-secondary"
          >
            Import from Zoho Assist
          </button>
        </PageHeader>
        <HardwareCaptureForm
          statuses={effectiveStatuses}
          onCreated={() => void load()}
        />

        {fetchError ? (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            {fetchError}
          </div>
        ) : null}

        <div className="section-card p-6">
          {assets.length ? (
            <>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-4">
                <label className="block min-w-0 flex-1 lg:max-w-xl">
                  <span className="text-xs font-semibold text-muted">
                    Search registry
                  </span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="search"
                      enterKeyHint="search"
                      value={registrySearch}
                      onChange={(e) => setRegistrySearch(e.target.value)}
                      placeholder="Name, club, serial, template, category, location, IP…"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ring-brand/30 focus:border-brand/50 focus:ring-2"
                      autoComplete="off"
                      aria-label="Search all assets table"
                    />
                    {registrySearch.trim() ? (
                      <button
                        type="button"
                        onClick={() => setRegistrySearch("")}
                        className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink hover:bg-black/[0.04]"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </label>
                <label className="block w-full sm:max-w-[220px]">
                  <span className="text-xs font-semibold text-muted">
                    Status
                  </span>
                  <select
                    value={statusFilterId}
                    onChange={(e) => setStatusFilterId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                    aria-label="Filter by lifecycle status"
                  >
                    <option value="">All statuses</option>
                    {statusesForFilter.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {registrySearch.trim() || statusFilterId ? (
                <p className="mb-3 text-xs text-muted">
                  Showing{" "}
                  <strong className="tabular-nums text-ink">
                    {filteredRegistryAssets.length}
                  </strong>{" "}
                  of {assets.length} assets
                  {statusFilterId
                    ? ` · status: ${effectiveStatuses.find((x) => x.id === statusFilterId)?.label ?? ""}`
                    : ""}
                  .{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrySearch("");
                      setStatusFilterId("");
                    }}
                    className="font-semibold text-brand-deep hover:underline"
                  >
                    Clear filters
                  </button>
                </p>
              ) : null}

              {filteredRegistryAssets.length === 0 ? (
                <div
                  className="rounded-lg border border-dashed border-line bg-black/[0.02] py-12 text-center text-sm text-muted"
                  role="status"
                >
                  No assets match these filters — adjust search or status, or{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setRegistrySearch("");
                      setStatusFilterId("");
                    }}
                    className="font-semibold text-brand-deep hover:underline"
                  >
                    reset filters
                  </button>
                  .
                </div>
              ) : (
                <div className="overflow-x-auto">
              <table className="w-full min-w-[1580px] text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-2 text-left font-medium">Club name</th>
                    <th className="py-2 text-left font-medium">Name</th>
                    <th className="py-2 text-left font-medium whitespace-nowrap">
                      Source
                    </th>
                    <th className="py-2 text-left font-medium">Tags</th>
                    <th className="py-2 text-left font-medium">
                      Manufacturer
                    </th>
                    <th className="py-2 text-left font-medium">Model</th>
                    <th className="py-2 text-left font-medium">Serial</th>
                    <th className="py-2 text-left font-medium">Location</th>
                    <th className="py-2 text-left font-medium">
                      CPU / RAM / GPU
                    </th>
                    <th className="py-2 text-left font-medium whitespace-nowrap">
                      Public IP
                    </th>
                    <th className="py-2 text-left font-medium">Region (GeoIP)</th>
                    <th className="py-2 text-left font-medium">Template</th>
                    <th className="py-2 text-left font-medium whitespace-nowrap">
                      Purchase
                    </th>
                    <th className="py-2 text-left font-medium whitespace-nowrap">
                      Warranty end
                    </th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-left font-medium">Reason</th>
                    <th className="py-2 text-left font-medium">Updated</th>
                    <th className="py-2 text-right font-medium whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistryAssets.map((a) => (
                    <tr key={a.id} className="border-b border-line">
                      <td className="py-2 text-ink">{a.club?.name ?? "—"}</td>
                      <td className="py-2">{a.assetName}</td>
                      <td className="py-2 text-xs">
                        {a.dataSource === "zoho_assist" ? (
                          <span className="rounded bg-brand-muted px-1.5 py-0.5 font-semibold text-brand-deep">
                            Assist
                          </span>
                        ) : (
                          "Manual"
                        )}
                      </td>
                      <td className="py-2">
                        <AssetTagChips tags={a.tags} category={a.category} size="xs" />
                      </td>
                      <td className="py-2">{displayAssetManufacturer(a) ?? "—"}</td>
                      <td className="py-2">{displayAssetModel(a) ?? "—"}</td>
                      <td className="py-2 font-mono text-xs">
                        {a.serialNumber ?? "—"}
                      </td>
                      <td className="max-w-[140px] py-2 text-xs text-ink">
                        {a.deviceLocation ?? "—"}
                      </td>
                      <td className="max-w-[200px] py-2 text-xs text-ink">
                        {[a.processorName, a.systemRam, a.systemGpu]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="py-2 font-mono text-xs text-ink">
                        {a.publicIp ?? "—"}
                      </td>
                      <td className="max-w-[160px] py-2 text-xs text-ink">
                        {formatGeoLabel(
                          a.geoCountryCode,
                          a.geoRegionCode,
                          a.geoCity,
                          a.geoRegionName
                        )}
                      </td>
                      <td className="py-2 text-xs text-ink">
                        {a.deviceTemplate
                          ? displayDeviceTemplateLabel(a.deviceTemplate)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs text-ink">
                        {a.purchaseDate
                          ? formatDate(a.purchaseDate)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs text-ink">
                        {a.warrantyEndDate
                          ? formatDate(a.warrantyEndDate)
                          : "—"}
                      </td>
                      <td className="py-2">
                        <select
                          value={a.status.id}
                          disabled={savingId === a.id}
                          onChange={(e) =>
                            void updateStatus(a.id, e.target.value)
                          }
                          className="max-w-[10rem] rounded border border-line bg-white px-1.5 py-1 text-xs text-ink"
                          aria-label={`Status for ${a.assetName}`}
                        >
                          {effectiveStatuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">{a.reason ?? "—"}</td>
                      <td className="py-2">
                        {formatDate(a.dateUpdated)}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(a.id)}
                            className="text-xs font-semibold text-brand-deep hover:underline"
                          >
                            Edit
                          </button>
                          <OverflowMenu
                            label={a.assetName}
                            items={[
                              {
                                label: "Delete",
                                destructive: true,
                                onSelect: () => setPendingDelete(a),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-muted">
              No assets yet. Use the form above to register hardware.
            </p>
          )}
        </div>

        <ImportAssistAssetModal
          open={assistImportOpen}
          onClose={() => setAssistImportOpen(false)}
          onImported={() => load()}
        />

        {openAssetId ? (
          <EditAssetModal
            key={openAssetId}
            assetId={openAssetId}
            statuses={effectiveStatuses}
            onClose={closeAsset}
            onSaved={closeAsset}
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

        <div className="rounded-lg border border-line bg-white p-6">
          <h3 className="font-heading mb-2 text-sm font-bold text-ink">
            Lifecycle states (extensible)
          </h3>
          <p className="text-xs text-muted">
            Add rows to AssetStatus table to load additional states.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {effectiveStatuses.map((s) => (
              <li
                key={s.id}
                className="rounded border border-line bg-brand-muted px-2 py-1 text-xs font-medium text-ink"
              >
                {s.label} ({s.code})
              </li>
            ))}
          </ul>
        </div>
      </main>
    
  );
}
