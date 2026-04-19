"use client";

import { useCallback, useEffect, useState } from "react";
import { EditAssetModal } from "@/components/EditAssetModal";
import { HardwareCaptureForm } from "@/components/HardwareCaptureForm";
import { ImportAssistAssetModal } from "@/components/ImportAssistAssetModal";
import { InventoryHeader } from "@/components/InventoryHeader";
import { formatGeoLabel } from "@/lib/geo/region-display";

type Asset = {
  id: string;
  assetName: string;
  category: string;
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
  deviceTemplate?: { id: string; label: string } | null;
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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assistImportOpen, setAssistImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetchError(null);
    const [aRes, sRes] = await Promise.all([
      fetch("/api/assets"),
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

  const effectiveStatuses =
    statuses.length > 0 ? statuses : deriveStatusesFromAssets(assets);

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
        if (!res.ok) throw new Error("Update failed");
        await load();
      } catch (e) {
        console.error(e);
      } finally {
        setSavingId(null);
      }
    },
    [assets, load]
  );

  const removeAsset = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`Delete “${name}”? This cannot be undone.`)) return;
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(
          typeof j.error === "string" ? j.error : "Delete failed"
        );
        return;
      }
      await load();
    },
    [load]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-black/55">Loading assets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="assets" />

      <main className="mx-auto max-w-6xl space-y-8 p-6">
        <HardwareCaptureForm
          statuses={effectiveStatuses}
          onCreated={() => void load()}
        />

        {fetchError ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            {fetchError}
          </div>
        ) : null}

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
                All assets
              </h2>
              <div className="mt-2 h-0.5 w-14 rounded-full bg-brand" />
            </div>
            <button
              type="button"
              onClick={() => setAssistImportOpen(true)}
              className="font-heading shrink-0 rounded-lg border-2 border-violet-600 bg-violet-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-violet-950 transition-colors hover:bg-violet-100"
            >
              Import from Zoho Assist
            </button>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-black/70">
            The table lists every unit. Use <strong>Register hardware</strong>{" "}
            above to add one <strong>physical unit</strong> at a time. Pick a{" "}
            <strong>device template</strong> (from Settings) so you don’t retype
            the same make/model — you still enter this unit’s{" "}
            <strong>serial</strong> and optional display name so each row is
            unique. Rows synced from Zoho Assist show <strong>Source: Assist</strong>{" "}
            and hardware details when populated. Use{" "}
            <strong>Import from Zoho Assist</strong> to pull an unattended device
            by name or from the Assist device list (same department as in Settings).
          </p>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          {assets.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1480px] text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="py-2 text-left font-medium">Name</th>
                    <th className="py-2 text-left font-medium whitespace-nowrap">
                      Source
                    </th>
                    <th className="py-2 text-left font-medium">Category</th>
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
                  {assets.map((a) => (
                    <tr key={a.id} className="border-b border-black/5">
                      <td className="py-2">{a.assetName}</td>
                      <td className="py-2 text-xs">
                        {a.dataSource === "zoho_assist" ? (
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-900">
                            Assist
                          </span>
                        ) : (
                          "Manual"
                        )}
                      </td>
                      <td className="py-2">{a.category}</td>
                      <td className="py-2">{a.manufacturer ?? "—"}</td>
                      <td className="py-2">{a.model ?? "—"}</td>
                      <td className="py-2 font-mono text-xs">
                        {a.serialNumber ?? "—"}
                      </td>
                      <td className="max-w-[140px] py-2 text-xs text-black/70">
                        {a.deviceLocation ?? "—"}
                      </td>
                      <td className="max-w-[200px] py-2 text-xs text-black/70">
                        {[a.processorName, a.systemRam, a.systemGpu]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="py-2 font-mono text-xs text-black/85">
                        {a.publicIp ?? "—"}
                      </td>
                      <td className="max-w-[160px] py-2 text-xs text-black/70">
                        {formatGeoLabel(
                          a.geoCountryCode,
                          a.geoRegionCode,
                          a.geoCity,
                          a.geoRegionName
                        )}
                      </td>
                      <td className="py-2 text-xs text-black/70">
                        {a.deviceTemplate?.label ?? "—"}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs text-black/70">
                        {a.purchaseDate
                          ? new Date(a.purchaseDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap py-2 text-xs text-black/70">
                        {a.warrantyEndDate
                          ? new Date(a.warrantyEndDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2">
                        <select
                          value={a.status.id}
                          disabled={savingId === a.id}
                          onChange={(e) =>
                            void updateStatus(a.id, e.target.value)
                          }
                          className="max-w-[10rem] rounded border border-black/15 bg-white px-1.5 py-1 text-xs text-black"
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
                        {new Date(a.dateUpdated).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingId(a.id)}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Edit
                        </button>
                        <span className="mx-1.5 text-black/25" aria-hidden>
                          ·
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeAsset(a.id, a.assetName)}
                          className="text-xs font-semibold text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-black/50">
              No assets yet. Use the form above to register hardware.
            </p>
          )}
        </div>

        <ImportAssistAssetModal
          open={assistImportOpen}
          onClose={() => setAssistImportOpen(false)}
          onImported={() => load()}
        />

        {editingId ? (
          <EditAssetModal
            assetId={editingId}
            statuses={effectiveStatuses}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              void load();
            }}
          />
        ) : null}

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h3 className="font-heading mb-2 text-sm font-bold uppercase tracking-wide text-black">
            Lifecycle states (extensible)
          </h3>
          <p className="text-xs text-black/55">
            Add rows to AssetStatus table to load additional states.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {effectiveStatuses.map((s) => (
              <li
                key={s.id}
                className="rounded border border-black/10 bg-brand-muted px-2 py-1 text-xs font-medium text-black/80"
              >
                {s.label} ({s.code})
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
