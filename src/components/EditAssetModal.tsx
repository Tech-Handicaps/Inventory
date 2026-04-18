"use client";

import { useCallback, useEffect, useState } from "react";

type StatusOpt = { id: string; code: string; label: string };
type TemplateOpt = {
  id: string;
  label: string;
  manufacturer: string | null;
  model: string | null;
};

type Props = {
  assetId: string;
  statuses: StatusOpt[];
  onClose: () => void;
  onSaved: () => void;
};

export function EditAssetModal({
  assetId,
  statuses,
  onClose,
  onSaved,
}: Props) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<TemplateOpt[]>([]);

  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [deviceLocation, setDeviceLocation] = useState("");
  const [processorName, setProcessorName] = useState("");
  const [systemRam, setSystemRam] = useState("");
  const [systemGpu, setSystemGpu] = useState("");
  const [statusId, setStatusId] = useState("");
  const [reason, setReason] = useState("");
  const [deviceTemplateId, setDeviceTemplateId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [aRes, tRes] = await Promise.all([
        fetch(`/api/assets/${assetId}`),
        fetch("/api/device-templates"),
      ]);
      const aJson = (await aRes.json()) as Record<string, unknown> & {
        error?: string;
      };
      if (!aRes.ok) {
        throw new Error(
          typeof aJson.error === "string" ? aJson.error : "Could not load asset"
        );
      }
      const tJson = await tRes.json();
      setTemplates(Array.isArray(tJson) ? (tJson as TemplateOpt[]) : []);

      setAssetName(String(aJson.assetName ?? ""));
      setCategory(String(aJson.category ?? ""));
      setSerialNumber(String(aJson.serialNumber ?? ""));
      setManufacturer(String(aJson.manufacturer ?? ""));
      setModel(String(aJson.model ?? ""));
      setDeviceLocation(String(aJson.deviceLocation ?? ""));
      setProcessorName(String(aJson.processorName ?? ""));
      setSystemRam(String(aJson.systemRam ?? ""));
      setSystemGpu(String(aJson.systemGpu ?? ""));
      const st = aJson.status as { id?: string } | undefined;
      setStatusId(st?.id ?? "");
      setReason(String(aJson.reason ?? ""));
      const tplId = aJson.deviceTemplateId;
      setDeviceTemplateId(
        typeof tplId === "string" && tplId ? tplId : ""
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetName: assetName.trim(),
          category: category.trim(),
          serialNumber: serialNumber.trim() || null,
          manufacturer: manufacturer.trim() || null,
          model: model.trim() || null,
          deviceLocation: deviceLocation.trim() || null,
          processorName: processorName.trim() || null,
          systemRam: systemRam.trim() || null,
          systemGpu: systemGpu.trim() || null,
          statusId,
          reason: reason.trim() || null,
          deviceTemplateId: deviceTemplateId || null,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "Save failed");
      }
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-asset-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-black/10 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-black/10 px-5 py-4">
          <h2
            id="edit-asset-title"
            className="font-heading text-lg font-bold uppercase tracking-wide text-black"
          >
            Edit asset
          </h2>
          <p className="mt-1 text-xs text-black/60">
            Update details and lifecycle status. Empty optional fields are cleared.
          </p>
        </div>

        <div className="px-5 py-4">
          {loadError ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              role="alert"
            >
              {loadError}
            </div>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-black/55">Loading…</p>
          ) : loadError ? null : (
            <form onSubmit={submit} className="space-y-3">
              {saveError ? (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                  role="alert"
                >
                  {saveError}
                </div>
              ) : null}

              <div>
                <label className="text-xs font-medium text-black/70">
                  Name
                </label>
                <input
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-black/70">
                    Category
                  </label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-black/70">
                    Status
                  </label>
                  <select
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-black/70">
                  Reason (e.g. write-off)
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-black/70">
                  Device template
                </label>
                <select
                  value={deviceTemplateId}
                  onChange={(e) => setDeviceTemplateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                      {t.manufacturer || t.model
                        ? ` (${[t.manufacturer, t.model].filter(Boolean).join(" ")})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-black/70">
                    Manufacturer
                  </label>
                  <input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-black/70">
                    Model
                  </label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-black/70">
                  Serial
                </label>
                <input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-black/70">
                  Location
                </label>
                <input
                  value={deviceLocation}
                  onChange={(e) => setDeviceLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-black/70">
                  CPU
                </label>
                <input
                  value={processorName}
                  onChange={(e) => setProcessorName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-black/70">RAM</label>
                  <input
                    value={systemRam}
                    onChange={(e) => setSystemRam(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-black/70">GPU</label>
                  <input
                    value={systemGpu}
                    onChange={(e) => setSystemGpu(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="font-heading rounded-lg border-2 border-brand bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-black/15 px-4 py-2 text-xs font-medium text-black/70 hover:bg-black/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
