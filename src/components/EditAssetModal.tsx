"use client";

import { useCallback, useEffect, useState } from "react";
import { AssistDevicePicker } from "@/components/AssistDevicePicker";
import { TagInput } from "@/components/ui/TagInput";
import { toDateInputValue } from "@/lib/dates/optional-iso-date";
import { assetTagsForDisplay } from "@/lib/inventory/asset-tags";
import { useAssetTagSuggestions } from "@/lib/inventory/use-asset-tag-suggestions";
import { formatGeoLabel } from "@/lib/geo/region-display";

type StatusOpt = { id: string; code: string; label: string };
type TemplateOpt = {
  id: string;
  label: string;
  manufacturer: string | null;
  model: string | null;
};

type ClubOpt = { id: string; name: string };

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
  const [clubs, setClubs] = useState<ClubOpt[]>([]);

  const [assetName, setAssetName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const { suggestions: tagSuggestions } = useAssetTagSuggestions();
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
  const [clubId, setClubId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyEndDate, setWarrantyEndDate] = useState("");
  const [publicIpDisplay, setPublicIpDisplay] = useState("");
  const [geoLine, setGeoLine] = useState("");
  const [zohoAssistDeviceId, setZohoAssistDeviceId] = useState("");
  const [assistDisplayName, setAssistDisplayName] = useState("");
  const [assistLinkBusy, setAssistLinkBusy] = useState(false);
  const [assistUnlinkBusy, setAssistUnlinkBusy] = useState(false);
  const [assistLinkNotice, setAssistLinkNotice] = useState<string | null>(null);
  const [assistLinkError, setAssistLinkError] = useState<string | null>(null);
  const [ipRefreshing, setIpRefreshing] = useState(false);

  const assistLinked = Boolean(zohoAssistDeviceId.trim());

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const [aRes, tRes, cRes] = await Promise.all([
        fetch(`/api/assets/${assetId}`),
        fetch("/api/device-templates"),
        fetch("/api/clubs"),
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
      const cJson = await cRes.json();
      setClubs(Array.isArray(cJson) ? (cJson as ClubOpt[]) : []);

      setAssetName(String(aJson.assetName ?? ""));
      setTags(
        assetTagsForDisplay(
          Array.isArray(aJson.tags) ? (aJson.tags as string[]) : [],
          typeof aJson.category === "string" ? aJson.category : ""
        )
      );
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
      const cid = aJson.clubId;
      setClubId(typeof cid === "string" && cid ? cid : "");
      setPurchaseDate(
        toDateInputValue(aJson.purchaseDate as string | undefined)
      );
      setWarrantyEndDate(
        toDateInputValue(aJson.warrantyEndDate as string | undefined)
      );
      setPublicIpDisplay(
        typeof aJson.publicIp === "string" ? aJson.publicIp : ""
      );
      setGeoLine(
        formatGeoLabel(
          aJson.geoCountryCode as string | undefined,
          aJson.geoRegionCode as string | undefined,
          aJson.geoCity as string | undefined,
          aJson.geoRegionName as string | undefined
        )
      );
      setAssistLinkNotice(null);
      setAssistLinkError(null);
      setZohoAssistDeviceId(
        typeof aJson.zohoAssistDeviceId === "string" ? aJson.zohoAssistDeviceId : ""
      );
      setAssistDisplayName(
        typeof aJson.assetName === "string" ? aJson.assetName : ""
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function linkToAssist(body: { resourceId: string }) {
    setAssistLinkBusy(true);
    setAssistLinkError(null);
    setAssistLinkNotice(null);
    try {
      const res = await fetch(`/api/assets/${assetId}/link-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        error?: string;
        code?: string;
        assetId?: string;
        assistDeviceId?: string;
        assistDisplayName?: string | null;
        serialMismatchWarning?: string | null;
      };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : "Could not link to Assist"
        );
      }
      if (j.serialMismatchWarning) {
        setAssistLinkNotice(j.serialMismatchWarning);
      } else {
        setAssistLinkNotice("Linked to Zoho Assist. Public IP and location will sync from Assist.");
      }
      await load({ silent: true });
    } catch (e) {
      setAssistLinkError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setAssistLinkBusy(false);
    }
  }

  async function unlinkFromAssist() {
    if (
      !window.confirm(
        "Unlink this asset from Zoho Assist? Registry details stay; only the Assist connection is removed."
      )
    ) {
      return;
    }
    setAssistUnlinkBusy(true);
    setAssistLinkError(null);
    setAssistLinkNotice(null);
    try {
      const res = await fetch(`/api/assets/${assetId}/unlink-assist`, {
        method: "POST",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Unlink failed");
      }
      setAssistLinkNotice("Zoho Assist link removed.");
      await load({ silent: true });
    } catch (e) {
      setAssistLinkError(e instanceof Error ? e.message : "Unlink failed");
    } finally {
      setAssistUnlinkBusy(false);
    }
  }

  async function refreshPublicIpFromAssist() {
    setIpRefreshing(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/sync-assist`, {
        method: "POST",
      });
      const j = (await res.json()) as { error?: string; detached?: boolean };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Refresh failed");
      }
      if (j.detached) {
        setAssistLinkNotice(
          "Assist link removed — stock name assigned (e.g. HNA-ST001). Hardware details kept."
        );
        onSaved();
        return;
      }
      await load({ silent: true });
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Could not refresh public IP"
      );
    } finally {
      setIpRefreshing(false);
    }
  }

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
          tags,
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
          clubId: clubId.trim() || null,
          purchaseDate: purchaseDate.trim() || null,
          warrantyEndDate: warrantyEndDate.trim() || null,
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
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-asset-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-5 py-4">
          <h2
            id="edit-asset-title"
            className="font-heading text-lg font-bold text-ink"
          >
            Edit asset
          </h2>
          <p className="mt-1 text-xs text-muted">
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
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
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
                <label className="text-xs font-medium text-ink">
                  Club name
                </label>
                <select
                  value={clubId}
                  onChange={(e) => setClubId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink">
                  Name
                </label>
                <input
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <TagInput
                label="Asset tags"
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                required
                hint="First tag is the primary category on reports. Add USB HID Magnetic Stripe Reader or Hardware as needed."
              />
              <div>
                <label className="text-xs font-medium text-ink">
                  Status
                </label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-ink">
                  Reason (e.g. write-off)
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink">
                  Device template
                </label>
                <select
                  value={deviceTemplateId}
                  onChange={(e) => setDeviceTemplateId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
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
                  <label className="text-xs font-medium text-ink">
                    Manufacturer
                  </label>
                  <input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink">
                    Model
                  </label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink">
                  Serial
                </label>
                <input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink">
                  Location
                </label>
                <input
                  value={deviceLocation}
                  onChange={(e) => setDeviceLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink">
                  CPU
                </label>
                <input
                  value={processorName}
                  onChange={(e) => setProcessorName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-ink">RAM</label>
                  <input
                    value={systemRam}
                    onChange={(e) => setSystemRam(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink">GPU</label>
                  <input
                    value={systemGpu}
                    onChange={(e) => setSystemGpu(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {assistLinkError ? (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                  role="alert"
                >
                  {assistLinkError}
                </div>
              ) : null}
              {assistLinkNotice ? (
                <div
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950"
                  role="status"
                >
                  {assistLinkNotice}
                </div>
              ) : null}

              <div className="rounded-lg border border-line bg-brand-muted/40 px-3 py-3">
                <p className="text-xs font-bold text-muted">
                  Zoho Assist
                </p>
                {assistLinked ? (
                  <>
                    <p className="mt-1 text-xs text-ink">
                      Linked device:{" "}
                      <span className="font-mono text-xs text-ink">
                        {zohoAssistDeviceId}
                      </span>
                      {assistDisplayName ? (
                        <span className="text-muted"> · {assistDisplayName}</span>
                      ) : null}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={assistUnlinkBusy || assistLinkBusy || ipRefreshing}
                        onClick={() => void unlinkFromAssist()}
                        className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
                      >
                        {assistUnlinkBusy ? "Unlinking…" : "Unlink Assist"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Link this unit to its unattended Assist device for live public IP
                      and GeoIP sync. Your <strong>serial number above is kept</strong>{" "}
                      as entered — use this when import failed due to a duplicate serial.
                    </p>
                    <div className="mt-3">
                      <AssistDevicePicker
                        disabled={assistLinkBusy || saving}
                        onLink={linkToAssist}
                        linkLabel="Link to Assist"
                      />
                    </div>
                  </>
                )}
              </div>

              {assistLinked ? (
                <div className="rounded-lg border border-line bg-brand-muted/50 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-muted">
                        Public IP &amp; location (Assist + GeoIP)
                      </p>
                      <p className="mt-1 font-mono text-sm text-ink">
                        {publicIpDisplay || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{geoLine}</p>
                    </div>
                    <button
                      type="button"
                      disabled={ipRefreshing}
                      onClick={() => void refreshPublicIpFromAssist()}
                      className="shrink-0 rounded-lg border border-brand bg-brand px-2 py-1.5 text-xs font-bold text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      {ipRefreshing ? "Refreshing…" : "Refresh from Assist"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Updated on import and by weekly sync. VPNs may change apparent
                    region.
                  </p>
                </div>
              ) : null}

              <div className="rounded-lg border border-line bg-black/[0.02] px-3 py-3">
                <p className="text-xs font-bold text-muted">
                  Acquisition & warranty
                </p>
                <p className="mt-1 text-xs text-muted">
                  Optional — improves procurement and age analytics on the dashboard.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-ink">
                      Purchase date
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink">
                      Warranty end
                    </label>
                    <input
                      type="date"
                      value={warrantyEndDate}
                      onChange={(e) => setWarrantyEndDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-black/5"
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
