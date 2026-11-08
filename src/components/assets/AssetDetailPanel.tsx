"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Pencil, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { AssetTagChips } from "@/components/ui/AssetTagChips";
import { STAGE_DOT } from "@/components/board/types";
import { formatDate, formatDateTime } from "@/lib/dates/format";
import { formatGeoLabel } from "@/lib/geo/region-display";
import { assetLocation } from "@/lib/inventory/asset-location";
import {
  displayAssetManufacturer,
  displayAssetModel,
} from "@/lib/inventory/asset-hardware-display";
import { displayDeviceTemplateLabel } from "@/lib/inventory/device-template-label";

type Status = { id: string; code: string; label: string };

type DeskLinked = {
  id: string;
  referenceNumber: string;
  zohoDeskTicketId: string | null;
  zohoDeskTicketNumber: string | null;
  zohoDeskUrl: string | null;
  createdAt: string;
};

type Detail = {
  asset: {
    id: string;
    assetName: string;
    category: string;
    tags: string[];
    serialNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    dataSource: string;
    deviceLocation: string | null;
    processorName: string | null;
    systemRam: string | null;
    systemGpu: string | null;
    zohoAssistDeviceId: string | null;
    lastSyncedFromAssistAt: string | null;
    publicIp: string | null;
    geoCountryCode: string | null;
    geoRegionCode: string | null;
    geoRegionName: string | null;
    geoCity: string | null;
    purchaseDate: string | null;
    warrantyEndDate: string | null;
    reason: string | null;
    dateAdded: string;
    dateUpdated: string;
    status: Status;
    club: { id: string; name: string } | null;
    deviceTemplate: { id: string; label: string; manufacturer: string | null; model: string | null } | null;
    assessments: (DeskLinked & { workflowStatus: string; intakeNotes: string | null })[];
    repairs: (DeskLinked & { repairStatus: string; technicianNotes: string | null })[];
    dispatchVouchers: { id: string; referenceNumber: string; fromStatusCode: string; clubName: string | null; dispatchedAt: string }[];
    writeOffCertificates: { id: string; referenceNumber: string; reason: string | null; writtenOffAt: string }[];
  };
  history: { id: string; actionType: string; timestamp: string; notes: string | null; actor: string | null }[];
  historyLimit: number;
  links: { zohoAssistConsole: string | null };
};

type Props = {
  assetId: string;
  statuses: Status[];
  /** True while a dialog above the panel owns the Esc key. */
  suspendEsc: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => void;
};

const ACTION_LABELS: Record<string, string> = {
  "asset.created": "Added",
  "asset.updated": "Edited",
  "asset.deleted": "Deleted",
  "asset.write_off": "Written off",
  "asset.refurbished": "Refurbished",
  "asset.imported_from_zoho_assist": "Imported from Zoho Assist",
  "asset.linked_to_zoho_assist": "Linked to Zoho Assist",
  "asset.unlinked_from_zoho_assist": "Unlinked from Zoho Assist",
  "asset.redeployed_from_zoho_assist": "Redeployed from Zoho Assist",
  "assessment.created": "Assessment opened",
  "assessment.completed": "Assessment completed",
  "assessment.cancelled": "Assessment cancelled",
  "repair.created": "Repair logged",
  "dispatch.created": "Dispatched",
};

function actionLabel(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType.replace(/[._]/g, " ");
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const empty = value == null || value === "" || value === "—";
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm text-ink ${mono ? "font-mono text-xs" : ""} ${empty ? "text-muted" : ""}`}>
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="font-heading mb-3 text-sm font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function DeskLink({ item }: { item: DeskLinked }) {
  if (!item.zohoDeskTicketId && !item.zohoDeskTicketNumber) return null;
  const label = `Desk #${(item.zohoDeskTicketNumber ?? item.zohoDeskTicketId ?? "").replace(/^#/, "")}`;
  return item.zohoDeskUrl ? (
    <a
      href={item.zohoDeskUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-deep hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  ) : (
    <span className="text-xs text-muted">{label}</span>
  );
}

/** Right-hand detail sheet for All assets. Opens over the list so its scroll position is kept. */
export function AssetDetailPanel({ assetId, statuses, suspendEsc, onClose, onEdit, onChanged }: Props) {
  const toast = useToast();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/assets/${assetId}/detail`, { cache: "no-store" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(typeof j.error === "string" ? j.error : `Could not load asset (${res.status}).`);
    }
    return (await res.json()) as Detail;
  }, [assetId]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load asset.");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (suspendEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [suspendEsc, onClose]);

  const changeStatus = async (statusId: string) => {
    if (!detail || statusId === detail.asset.status.id) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; warning?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Status change failed");
      if (j.warning) toast.showError(j.warning);
      else toast.showSuccess("Status updated.");
      setDetail(await load());
      onChanged();
    } catch (e) {
      toast.showError(e instanceof Error ? e.message : "Status change failed");
    } finally {
      setSavingStatus(false);
    }
  };

  const a = detail?.asset;
  const geo = a ? formatGeoLabel(a.geoCountryCode, a.geoRegionCode, a.geoCity, a.geoRegionName) : "—";
  const location = a ? assetLocation(a) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="asset-panel-title">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-black/20"
        aria-label="Close asset details"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[min(100vw,30rem)] flex-col border-l border-line bg-white shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <h2 id="asset-panel-title" className="font-heading truncate text-lg font-semibold text-ink" title={a?.assetName}>
              {a?.assetName ?? (error ? "Asset" : "Loading…")}
            </h2>
            {a ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STAGE_DOT[a.status.code] ?? "bg-muted"}`} aria-hidden />
                  {a.status.label}
                </span>
                {a.club ? <span>· {a.club.name}</span> : null}
                {a.serialNumber ? <span className="font-mono">· SN {a.serialNumber}</span> : null}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink hover:bg-black/[0.05]"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="px-5 py-6 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : !a ? (
            <div className="space-y-3 px-5 py-6" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-black/[0.06]" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3 px-5 pb-4">
                <button type="button" onClick={onEdit} className="btn-primary">
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </button>
                <label className="block min-w-[10rem] flex-1">
                  <span className="text-xs font-semibold text-muted">Status</span>
                  <select
                    value={a.status.id}
                    disabled={savingStatus}
                    onChange={(e) => void changeStatus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Section title="Details">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Club" value={a.club?.name} />
                  <Field label="Location" value={location ? <span title={location.tip}>{location.text}</span> : null} />
                  <Field label="Manufacturer" value={displayAssetManufacturer(a)} />
                  <Field label="Model" value={displayAssetModel(a)} />
                  <Field label="Serial" value={a.serialNumber} mono />
                  <Field label="Template" value={a.deviceTemplate ? displayDeviceTemplateLabel(a.deviceTemplate) : null} />
                  <Field label="Source" value={a.dataSource === "zoho_assist" ? "Zoho Assist" : "Manual"} />
                  <Field label="Category" value={a.category} />
                  <div className="col-span-2">
                    <Field label="Tags" value={a.tags?.length ? <AssetTagChips tags={a.tags} category={a.category} size="xs" /> : null} />
                  </div>
                  <Field label="CPU" value={a.processorName} />
                  <Field label="RAM" value={a.systemRam} />
                  <div className="col-span-2">
                    <Field label="GPU" value={a.systemGpu} />
                  </div>
                  <Field label="Public IP" value={a.publicIp} mono />
                  <Field label="Approximate location (GeoIP)" value={geo} />
                  <Field label="Purchase" value={formatDate(a.purchaseDate, "")} />
                  <Field label="Warranty end" value={formatDate(a.warrantyEndDate, "")} />
                  {a.reason ? (
                    <div className="col-span-2">
                      <Field label="Reason" value={a.reason} />
                    </div>
                  ) : null}
                  <Field label="Added" value={formatDate(a.dateAdded)} />
                  <Field label="Updated" value={formatDateTime(a.dateUpdated)} />
                </dl>
              </Section>

              <Section title="Integrations">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-2">
                    <Field
                      label="Zoho Assist device"
                      value={
                        a.zohoAssistDeviceId ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs">{a.zohoAssistDeviceId}</span>
                            {detail.links.zohoAssistConsole ? (
                              <a
                                href={detail.links.zohoAssistConsole}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-deep hover:underline"
                              >
                                Open Zoho Assist
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </a>
                            ) : null}
                          </span>
                        ) : (
                          "Not linked"
                        )
                      }
                    />
                  </div>
                  {a.zohoAssistDeviceId ? (
                    <Field label="Last Assist sync" value={a.lastSyncedFromAssistAt ? formatDateTime(a.lastSyncedFromAssistAt) : null} />
                  ) : null}
                </dl>
                {[...a.assessments, ...a.repairs].some((x) => x.zohoDeskTicketId || x.zohoDeskTicketNumber) ? (
                  <ul className="mt-3 space-y-1">
                    {[...a.assessments, ...a.repairs]
                      .filter((x) => x.zohoDeskTicketId || x.zohoDeskTicketNumber)
                      .map((x) => (
                        <li key={x.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-muted">{x.referenceNumber}</span>
                          <DeskLink item={x} />
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted">No Zoho Desk tickets linked.</p>
                )}
              </Section>

              {a.assessments.length || a.repairs.length || a.dispatchVouchers.length || a.writeOffCertificates.length ? (
                <Section title="Lifecycle records">
                  <ul className="space-y-2 text-sm">
                    {a.assessments.map((x) => (
                      <li key={x.id} className="rounded-md border border-line px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Assessment · {x.workflowStatus}</span>
                          <span className="text-xs text-muted">{formatDate(x.createdAt)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted">{x.referenceNumber}</span>
                          <DeskLink item={x} />
                        </div>
                        {x.intakeNotes ? <p className="mt-1 text-xs text-ink">{x.intakeNotes}</p> : null}
                      </li>
                    ))}
                    {a.repairs.map((x) => (
                      <li key={x.id} className="rounded-md border border-line px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Repair · {x.repairStatus.replace(/_/g, " ")}</span>
                          <span className="text-xs text-muted">{formatDate(x.createdAt)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted">{x.referenceNumber}</span>
                          <DeskLink item={x} />
                        </div>
                        {x.technicianNotes ? <p className="mt-1 text-xs text-ink">{x.technicianNotes}</p> : null}
                      </li>
                    ))}
                    {a.dispatchVouchers.map((x) => (
                      <li key={x.id} className="rounded-md border border-line px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Dispatched{x.clubName ? ` to ${x.clubName}` : ""}</span>
                          <span className="text-xs text-muted">{formatDate(x.dispatchedAt)}</span>
                        </div>
                        <span className="font-mono text-xs text-muted">{x.referenceNumber}</span>
                      </li>
                    ))}
                    {a.writeOffCertificates.map((x) => (
                      <li key={x.id} className="rounded-md border border-line px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">Written off</span>
                          <span className="text-xs text-muted">{formatDate(x.writtenOffAt)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted">{x.referenceNumber}</span>
                          <a
                            href={`/api/assets/${a.id}/write-off-certificate`}
                            className="text-xs font-semibold text-brand-deep hover:underline"
                          >
                            Certificate PDF
                          </a>
                        </div>
                        {x.reason ? <p className="mt-1 text-xs text-ink">{x.reason}</p> : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section title="History">
                {detail.history.length ? (
                  <ol className="space-y-3">
                    {detail.history.map((h) => (
                      <li key={h.id} className="border-l-2 border-line pl-3">
                        <p className="text-sm font-medium text-ink">{actionLabel(h.actionType)}</p>
                        {h.notes ? <p className="text-xs text-ink">{h.notes}</p> : null}
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDateTime(h.timestamp)}
                          {h.actor ? ` · ${h.actor}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-muted">No recorded changes yet.</p>
                )}
                {detail.history.length >= detail.historyLimit ? (
                  <p className="mt-3 text-xs text-muted">Showing the latest {detail.historyLimit} entries.</p>
                ) : null}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
