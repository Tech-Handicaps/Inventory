"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAppRole } from "@/components/RoleProvider";
import { SectionSkeleton } from "@/components/Skeleton";
import { isReportsAdmin } from "@/lib/auth/reports-admin";
import { formatDate, formatDateTime } from "@/lib/dates/format";
import { createClient } from "@/lib/supabase/client";
import type { PeriodKind } from "@/lib/reports/period-catalog";
import {
  ALLOWED_PERIOD_MIME,
  MAX_PERIOD_DOCUMENT_BYTES,
  PERIOD_DOCUMENT_KINDS,
  type PeriodDocumentKind,
} from "@/lib/reports/period-document-kinds";
import type { HandoverRow, InconsistencyRow, PeriodRow, PeriodsOverview } from "@/lib/reports/period-records";

const KIND_BADGE: Record<PeriodKind, { label: string; className: string }> = {
  prior_count: { label: "Prior-company count", className: "bg-sky-50 text-sky-800 border-sky-200" },
  albatros_no_count: { label: "Carried forward", className: "bg-amber-50 text-amber-800 border-amber-200" },
  handover: { label: "Hand-over", className: "bg-violet-50 text-violet-800 border-violet-200" },
  no_count: { label: "No count", className: "bg-amber-50 text-amber-800 border-amber-200" },
  emailed_not_stored: { label: "Emailed, not stored", className: "bg-slate-100 text-slate-700 border-slate-200" },
  system_pack: { label: "System pack", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
};

function mimeOf(file: File): string {
  if (file.type && ALLOWED_PERIOD_MIME.includes(file.type)) return file.type;
  return MIME_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
}

function hasCountPdf(period: PeriodRow) {
  return period.hasStoredReport && period.kind !== "emailed_not_stored" && period.kind !== "system_pack";
}

function UploadForm({ period, onDone }: { period: PeriodRow; onDone: () => void }) {
  const reimport = period.kind === "emailed_not_stored";
  const [kind, setKind] = useState<PeriodDocumentKind>(reimport ? "reimported_pack" : "source_workbook");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kinds = (Object.keys(PERIOD_DOCUMENT_KINDS) as PeriodDocumentKind[]).filter(
    (value) => value !== "reimported_pack" || reimport
  );

  async function upload() {
    if (!file) return;
    const mimeType = mimeOf(file);
    if (!ALLOWED_PERIOD_MIME.includes(mimeType)) return setError("Upload a PDF, Excel, Word or CSV file");
    if (file.size > MAX_PERIOD_DOCUMENT_BYTES) return setError("Files must be under 25 MB");
    setBusy(true);
    setError(null);
    try {
      const start = await fetch("/api/reports/period-documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey: period.monthKey, fileName: file.name, mimeType, sizeBytes: file.size }),
      });
      const target = (await start.json().catch(() => ({}))) as { bucket?: string; path?: string; token?: string; error?: string };
      if (!start.ok || !target.bucket || !target.path || !target.token) throw new Error(target.error ?? "Could not start the upload");

      const { error: uploadError } = await createClient()
        .storage.from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, file, { contentType: mimeType });
      if (uploadError) throw new Error(uploadError.message);

      const finish = await fetch("/api/reports/period-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthKey: period.monthKey,
          kind,
          path: target.path,
          fileName: file.name,
          title,
          notes,
          documentDate: documentDate || undefined,
        }),
      });
      const done = (await finish.json().catch(() => ({}))) as { error?: string };
      if (!finish.ok) throw new Error(done.error ?? "Could not record the file");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line bg-white p-4">
      <p className="text-sm font-medium text-ink">
        {reimport ? "Re-import the emailed pack or add a file" : "Attach a file to this month"}
      </p>
      <p className="text-xs text-muted">
        Files are{" "}
        <span
          className="underline decoration-dotted underline-offset-2"
          title="Each file is stored with its SHA-256 hash, so any later change to the file would show."
        >
          kept exactly as uploaded
        </span>{" "}
        and cannot be edited afterwards. Service Desk Reports and the Master sheet are marked as supporting documents only.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink">
          Type
          <select className="input-field mt-1 px-3 py-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as PeriodDocumentKind)}>
            {kinds.map((value) => (
              <option key={value} value={value}>
                {PERIOD_DOCUMENT_KINDS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink">
          File
          <input
            type="file"
            accept=".pdf,.xlsx,.xls,.docx,.csv"
            className="mt-1 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="text-xs font-medium text-ink">
          Title (optional)
          <input className="input-field mt-1 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="text-xs font-medium text-ink">
          Document date (optional)
          <input type="date" className="input-field mt-1 px-3 py-2 text-sm" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
        </label>
      </div>
      <label className="block text-xs font-medium text-ink">
        Notes (optional)
        <input className="input-field mt-1 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="button" className="btn-primary py-2 text-xs" disabled={!file || busy} onClick={upload}>
        {busy ? "Uploading…" : "Upload"}
      </button>
    </div>
  );
}

function PeriodDetail({ period, canEdit, onChanged }: { period: PeriodRow; canEdit: boolean; onChanged: () => void }) {
  return (
    <div className="space-y-4 bg-slate-50 px-4 py-4">
      <p className="max-w-3xl text-sm text-ink">{period.detail}</p>
      {period.memoUnits ? (
        <p className="text-xs text-muted">
          Memo: {period.memoUnits} dongles listed beside the Posiflex line, not counted and since written off in full.
        </p>
      ) : null}

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-muted">Files</h4>
        {period.documents.length === 0 ? (
          <p className="text-sm text-muted">No files attached yet.</p>
        ) : (
          <ul className="space-y-2">
            {period.documents.map((doc) => (
              <li key={doc.id} className="text-sm">
                <a href={`/api/reports/period-documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-deep hover:underline">
                  {doc.title}
                </a>{" "}
                <span className="text-xs text-muted">
                  {doc.kindLabel}
                  {doc.documentDate ? ` · dated ${formatDate(doc.documentDate)}` : ""} · uploaded {formatDateTime(doc.uploadedAt)}
                </span>
                {doc.flag ? <span className="ml-2 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">{doc.flag}</span> : null}
                {doc.kind === "auditor_note" ? (
                  <span className="ml-2 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-xs text-violet-900">
                    Not a stock count
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {period.events.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted">Movements in this period (prior company)</h4>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">What</th>
                  <th className="px-3 py-2 font-medium">Serials</th>
                  <th className="px-3 py-2 font-medium">From → to</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {period.events.map((event) => (
                  <tr key={event.id} className="border-b border-line align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(event.eventDate)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{event.assetLabel}</div>
                      <div className="text-muted">{event.description}</div>
                    </td>
                    <td className="px-3 py-2 font-mono">{event.serials.join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      {event.fromLocation} → {event.toLocation}
                    </td>
                    <td className="px-3 py-2">{event.reference}</td>
                    <td className="px-3 py-2">
                      {event.evidenceDocumentId ? (
                        <a href={`/api/reports/period-documents/${event.evidenceDocumentId}`} target="_blank" rel="noopener noreferrer" className="text-brand-deep hover:underline">
                          {event.evidenceFileName}
                        </a>
                      ) : (
                        <span className="text-muted">{event.evidenceFileName} (not uploaded yet)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {canEdit && period.kind !== "system_pack" ? <UploadForm period={period} onDone={onChanged} /> : null}
    </div>
  );
}

function HandoverCard({ handover, canEdit, onChanged }: { handover: HandoverRow | null; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [receivedOn, setReceivedOn] = useState(handover?.receivedOn?.slice(0, 10) ?? "");
  const [receivedBy, setReceivedBy] = useState(handover?.receivedBy ?? "");
  const [reference, setReference] = useState(handover?.reference ?? "");
  const [notes, setNotes] = useState(handover?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const res = await fetch("/api/reports/handover-record", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receivedOn, receivedBy, reference, notes }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setError(body.error ?? "Could not save");
    setEditing(false);
    onChanged();
  }

  return (
    <section className="section-card space-y-3 p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-heading text-base font-bold text-ink">May 2026 hand-over record</h3>
          <p className="text-xs text-muted">No receiving count was done; this records how the stock was accepted.</p>
        </div>
        {canEdit && !editing ? (
          <button type="button" className="btn-secondary py-2 text-xs" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </header>
      {!handover ? (
        <p className="text-sm text-muted">No hand-over record yet.</p>
      ) : editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink">
            Date received (May 2026)
            <input type="date" min="2026-05-01" max="2026-05-31" className="input-field mt-1 px-3 py-2 text-sm" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-ink">
            Received by
            <input className="input-field mt-1 px-3 py-2 text-sm" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-ink">
            Reference
            <input className="input-field mt-1 px-3 py-2 text-sm" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label className="text-xs font-medium text-ink sm:col-span-2">
            Notes
            <textarea className="input-field mt-1 min-h-[80px] px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" className="btn-primary py-2 text-xs" onClick={save}>
              Save
            </button>
            <button type="button" className="btn-secondary py-2 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted">From</dt>
          <dd>{handover.fromParty}</dd>
          <dt className="text-muted">Date received</dt>
          <dd>{handover.receivedOn ? formatDate(handover.receivedOn) : "To be confirmed"}</dd>
          <dt className="text-muted">Received by</dt>
          <dd>{handover.receivedBy ?? "To be confirmed"}</dd>
          <dt className="text-muted">Reference</dt>
          <dd>{handover.reference ?? "—"}</dd>
          <dt className="text-muted">Basis</dt>
          <dd>{handover.basis}</dd>
          {handover.notes ? (
            <>
              <dt className="text-muted">Notes</dt>
              <dd>{handover.notes}</dd>
            </>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function Inconsistencies({ rows, canEdit, onChanged }: { rows: InconsistencyRow[]; canEdit: boolean; onChanged: () => void }) {
  async function update(row: InconsistencyRow, status: "resolved" | "open") {
    const resolution = status === "resolved" ? window.prompt("How was this resolved?") : "";
    if (status === "resolved" && !resolution) return;
    const res = await fetch(`/api/reports/inconsistencies/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(body.error ?? "Could not update");
      return;
    }
    onChanged();
  }

  const open = rows.filter((row) => row.status !== "resolved").length;
  return (
    <section className="section-card space-y-3 p-5">
      <h3 className="font-heading text-base font-bold text-ink">
        Inconsistencies in the prior-company records ({open} open)
      </h3>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="border-b border-line pb-3 text-sm last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="font-medium text-ink">
                {row.title}
                {row.monthKey ? <span className="ml-2 text-xs font-normal text-muted">{row.monthKey}</span> : null}
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-xs ${row.status === "resolved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {row.status === "resolved" ? "Resolved" : "Open"}
              </span>
            </div>
            <p className="mt-1 text-muted">{row.detail}</p>
            {row.resolution ? (
              <p className="mt-1 text-xs text-ink">
                Resolution: {row.resolution}
                {row.resolvedAt ? ` (${formatDate(row.resolvedAt)})` : ""}
              </p>
            ) : null}
            {canEdit ? (
              <button type="button" className="mt-1 text-xs font-medium text-brand-deep hover:underline" onClick={() => update(row, row.status === "resolved" ? "open" : "resolved")}>
                {row.status === "resolved" ? "Reopen" : "Mark resolved"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PeriodsSection() {
  const { role } = useAppRole();
  const canEdit = isReportsAdmin(role);
  const [data, setData] = useState<PeriodsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports/periods");
      if (!res.ok) throw new Error("Could not load report periods");
      setData((await res.json()) as PeriodsOverview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report periods");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return <SectionSkeleton label="Loading report periods" />;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 font-medium">What is on record</th>
              <th className="px-4 py-3 text-right font-medium">Units</th>
              <th className="px-4 py-3 font-medium">Report</th>
              <th className="px-4 py-3 font-medium">Files</th>
            </tr>
          </thead>
          <tbody>
            {data.periods.map((period) => {
              const badge = KIND_BADGE[period.kind];
              const expanded = openMonth === period.monthKey;
              const auditorNotes = period.documents.filter((doc) => doc.kind === "auditor_note");
              const otherFiles = period.documents.length - auditorNotes.length;
              const pdf = `/api/reports/legacy-month-end/pdf?month=${period.monthKey}`;
              return (
                <Fragment key={period.monthKey}>
                  <tr className="border-b border-line align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium">{period.monthLabel}</div>
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium text-brand-deep hover:underline"
                        aria-expanded={expanded}
                        onClick={() => setOpenMonth(expanded ? null : period.monthKey)}
                      >
                        {expanded ? "Hide details" : "Details"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
                      <div className="mt-1 max-w-md text-ink">{period.title}</div>
                      {auditorNotes.map((doc) => (
                        <div key={doc.id} className="mt-2 max-w-md rounded border border-violet-200 bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
                          <span className="font-semibold">Auditor note – not a stock count.</span>{" "}
                          <a href={`/api/reports/period-documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="underline">
                            {doc.title}
                          </a>{" "}
                          is filed here for reference and adds no units to {period.monthLabel}.
                        </div>
                      ))}
                      {period.openFlags > 0 ? <div className="mt-1 text-xs text-amber-800">{period.openFlags} open inconsistency flag(s)</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {period.totals ? period.totals.units : period.pack ? period.pack.register : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {hasCountPdf(period) ? (
                        <span className="flex gap-2">
                          <a href={pdf} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-deep hover:underline">
                            Open PDF
                          </a>
                          <a href={`${pdf}&download=1`} className="text-muted hover:underline">
                            Download
                          </a>
                        </span>
                      ) : period.pack ? (
                        <span className="text-xs text-muted">See Monthly pack</span>
                      ) : period.kind === "system_pack" ? (
                        <span className="text-xs text-muted">Not stored yet</span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {otherFiles || !auditorNotes.length ? `${otherFiles} file(s)` : ""}
                      {auditorNotes.length ? `${otherFiles ? " · " : ""}${auditorNotes.length} auditor note` : ""}
                      {period.events.length ? ` · ${period.events.length} movement(s)` : ""}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-line">
                      <td colSpan={5} className="p-0">
                        <PeriodDetail period={period} canEdit={canEdit} onChanged={load} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <HandoverCard key={data.handover?.updatedAt ?? "none"} handover={data.handover} canEdit={canEdit} onChanged={load} />
        <Inconsistencies rows={data.inconsistencies} canEdit={canEdit} onChanged={load} />
      </div>
    </div>
  );
}
