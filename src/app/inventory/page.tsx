"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditAssetModal } from "@/components/EditAssetModal";
import { HardwareCaptureForm } from "@/components/HardwareCaptureForm";
import { InventoryHeader } from "@/components/InventoryHeader";
import { LogRepairModal } from "@/components/LogRepairModal";

type Status = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
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
  status: Status;
  deviceTemplate?: { id: string; label: string } | null;
};

const PRIMARY_ORDER = [
  "new_stock",
  "in_stock",
  "deployed",
  "repair",
  "refurbished",
] as const;

/** Brand-aligned columns: green reserved for “In stock”; distinct hues elsewhere */
const columnAccent: Record<string, string> = {
  new_stock: "border-t-black bg-white",
  in_stock: "border-t-brand bg-brand-muted",
  deployed: "border-t-sky-500 bg-sky-50/90",
  repair: "border-t-orange-500 bg-orange-50/90",
  refurbished: "border-t-[#0b5d2e] bg-emerald-50/80",
  written_off: "border-t-neutral-400 bg-neutral-100",
};

export default function InventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [repairAsset, setRepairAsset] = useState<Asset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [aRes, sRes] = await Promise.all([
      fetch("/api/assets?limit=500"),
      fetch("/api/statuses"),
    ]);
    const aJson = await aRes.json();
    const sJson = await sRes.json();
    setAssets(aJson.assets ?? []);
    setStatuses(Array.isArray(sJson) ? sJson : []);
  }, []);

  useEffect(() => {
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  const byStatus = useMemo(() => {
    const m = new Map<string, Asset[]>();
    for (const s of statuses) m.set(s.id, []);
    for (const asset of assets) {
      const list = m.get(asset.status.id);
      if (list) list.push(asset);
      else m.set(asset.status.id, [asset]);
    }
    return m;
  }, [assets, statuses]);

  const orderedPrimary = useMemo(() => {
    const map = new Map(statuses.map((s) => [s.code, s]));
    return PRIMARY_ORDER.map((code) => map.get(code)).filter(
      (s): s is Status => Boolean(s)
    );
  }, [statuses]);

  const writtenOff = useMemo(
    () => statuses.find((s) => s.code === "written_off"),
    [statuses]
  );

  async function updateAssetStatus(assetId: string, statusId: string) {
    setSavingId(assetId);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId }),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated = (await res.json()) as Asset;
      setAssets((prev) =>
        prev.map((x) =>
          x.id === assetId
            ? { ...x, ...updated, status: updated.status }
            : x
        )
      );
    } catch (e) {
      console.error(e);
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
        <p className="text-black/55">Loading hardware inventory…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="inventory" />

      <main className="mx-auto max-w-7xl space-y-8 p-6">
        <HardwareCaptureForm statuses={statuses} onCreated={() => load()} />

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            How this board is organized
          </h2>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-black/70">
            Each column is a lifecycle stage for hardware. Use{" "}
            <strong>Register hardware</strong> above (template + serial), then
            move cards by changing status. Use{" "}
            <strong>Settings → Device templates</strong> for reusable make/model
            presets. Status codes live in the database so you can extend stages
            later without losing data.
          </p>
        </div>

        <section>
          <h2 className="font-heading mb-4 text-sm font-bold uppercase tracking-[0.15em] text-black">
            Stock & workflow
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {orderedPrimary.map((st) => (
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
                  <p className="mt-2 text-2xl font-bold tabular-nums text-black">
                    {(byStatus.get(st.id) ?? []).length}
                  </p>
                </div>
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {(byStatus.get(st.id) ?? []).map((asset) => (
                    <li key={asset.id}>
                      <HardwareCard
                        asset={asset}
                        statuses={statuses}
                        disabled={savingId === asset.id}
                        onStatusChange={updateAssetStatus}
                        onLogRepair={() => setRepairAsset(asset)}
                        onEdit={() => setEditingId(asset.id)}
                        onDelete={() => void removeAsset(asset.id, asset.assetName)}
                      />
                    </li>
                  ))}
                  {(byStatus.get(st.id) ?? []).length === 0 && (
                    <li className="rounded-lg border border-dashed border-black/15 py-8 text-center text-sm text-black/40">
                      Nothing in this stage.
                    </li>
                  )}
                </ul>
              </div>
            ))}
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
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Manufacturer</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Serial</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Stage</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(byStatus.get(writtenOff.id) ?? []).map((asset) => (
                      <tr
                        key={asset.id}
                        className="border-b border-black/5"
                      >
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
                          <select
                            className="w-full max-w-[200px] rounded border border-black/15 bg-white px-2 py-1 text-xs"
                            value={asset.status.id}
                            disabled={savingId === asset.id}
                            onChange={(e) =>
                              updateAssetStatus(asset.id, e.target.value)
                            }
                          >
                            {statuses.map((s) => (
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
                {(byStatus.get(writtenOff.id) ?? []).length === 0 && (
                  <p className="py-10 text-center text-sm text-black/45">
                    No written-off hardware.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
        <LogRepairModal
          asset={repairAsset}
          onClose={() => setRepairAsset(null)}
          onSuccess={() => load()}
        />

        {editingId ? (
          <EditAssetModal
            assetId={editingId}
            statuses={statuses.map((s) => ({
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
  onLogRepair,
  onEdit,
  onDelete,
}: {
  asset: Asset;
  statuses: Status[];
  disabled: boolean;
  onStatusChange: (id: string, statusId: string) => void;
  onLogRepair: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-lg border border-black/10 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading font-semibold text-black">
              {asset.assetName}
            </p>
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
        <button
          type="button"
          disabled={disabled}
          onClick={onLogRepair}
          className="font-heading w-full rounded-md border-2 border-orange-500/80 bg-orange-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-900 transition-colors hover:bg-orange-100 disabled:opacity-50"
        >
          Log repair
        </button>
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
            {statuses.map((s) => (
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
