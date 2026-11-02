"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppRole } from "@/components/RoleProvider";
import { SectionSkeleton } from "@/components/Skeleton";
import { isReportsAdmin } from "@/lib/auth/reports-admin";
import { formatDate } from "@/lib/dates/format";
import type { ReconciliationView } from "@/lib/reports/load-reconciliation";
import { RECON_SECTIONS, type ReconSection } from "@/lib/reports/reconciliation";
import { PdfButtons, TabIntro } from "./report-tile";

const PDF = "/api/reports/reconciliation/pdf";

type LineDraft = { section: ReconSection; label: string; quantity: string; status: "confirmed" | "to_be_confirmed"; notes: string };

const EMPTY_DRAFT: LineDraft = { section: "added", label: "", quantity: "", status: "to_be_confirmed", notes: "" };

async function sendJson(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? "Could not save";
}

function LineForm({ initial, onSubmit, onCancel }: { initial: LineDraft; onSubmit: (draft: LineDraft) => Promise<string | null>; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof LineDraft>(key: K, value: LineDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="grid gap-2 rounded-lg border border-line bg-slate-50 p-3 sm:grid-cols-[10rem_1fr_6rem_10rem]">
      <select className="input-field px-2 py-1.5 text-sm" value={draft.section} onChange={(e) => set("section", e.target.value as ReconSection)}>
        {(Object.keys(RECON_SECTIONS) as ReconSection[]).map((key) => (
          <option key={key} value={key}>
            {RECON_SECTIONS[key]}
          </option>
        ))}
      </select>
      <input className="input-field px-2 py-1.5 text-sm" placeholder="What this line is" value={draft.label} onChange={(e) => set("label", e.target.value)} />
      <input className="input-field px-2 py-1.5 text-sm" placeholder="± qty" inputMode="numeric" value={draft.quantity} onChange={(e) => set("quantity", e.target.value)} />
      <select className="input-field px-2 py-1.5 text-sm" value={draft.status} onChange={(e) => set("status", e.target.value as LineDraft["status"])}>
        <option value="to_be_confirmed">To be confirmed</option>
        <option value="confirmed">Confirmed</option>
      </select>
      <input className="input-field px-2 py-1.5 text-sm sm:col-span-4" placeholder="Notes / evidence" value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
      {error ? <p className="text-sm text-red-700 sm:col-span-4">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-4">
        <button
          type="button"
          className="btn-primary py-1.5 text-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const err = await onSubmit(draft);
            setBusy(false);
            setError(err);
          }}
        >
          Save line
        </button>
        <button type="button" className="btn-secondary py-1.5 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function toPayload(draft: LineDraft) {
  return { ...draft, quantity: Number(draft.quantity), notes: draft.notes || null };
}

function Bridge({ view, canEdit, onChanged }: { view: ReconciliationView; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const reg = view.register;

  async function remove(id: string, label: string) {
    if (!window.confirm(`Remove "${label}"? The removed line is kept in the audit log.`)) return;
    const err = await sendJson(`/api/reports/reconciliation/lines/${id}`, "DELETE");
    if (err) window.alert(err);
    else onChanged();
  }

  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 font-medium">Line</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Running total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canEdit ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {view.lines.map((line) =>
              editing === line.id ? (
                <tr key={line.id} className="border-b border-line">
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-3">
                    <LineForm
                      initial={{
                        section: line.section as ReconSection,
                        label: line.label,
                        quantity: String(line.quantity),
                        status: line.status === "confirmed" ? "confirmed" : "to_be_confirmed",
                        notes: line.notes ?? "",
                      }}
                      onCancel={() => setEditing(null)}
                      onSubmit={async (draft) => {
                        const err = await sendJson(`/api/reports/reconciliation/lines/${line.id}`, "PATCH", toPayload(draft));
                        if (!err) {
                          setEditing(null);
                          onChanged();
                        }
                        return err;
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={line.id} className="border-b border-line align-top">
                  <td className="px-4 py-3 text-xs text-muted">{RECON_SECTIONS[line.section as ReconSection] ?? line.section}</td>
                  <td className="px-4 py-3">
                    <div>{line.label}</div>
                    {line.notes ? <div className="text-xs text-muted">{line.notes}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{line.quantity > 0 && line.section !== "opening" ? `+${line.quantity}` : line.quantity}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{line.runningTotal}</td>
                  <td className="px-4 py-3 text-xs">
                    {line.status === "confirmed" ? (
                      <span className="text-emerald-800">Confirmed</span>
                    ) : (
                      <span className="text-amber-800">To be confirmed</span>
                    )}
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                      <button type="button" className="font-medium text-brand-deep hover:underline" onClick={() => setEditing(line.id)}>
                        Edit
                      </button>{" "}
                      <button type="button" className="ml-2 text-muted hover:underline" onClick={() => remove(line.id, line.label)}>
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            )}
            <tr className="border-b border-line bg-slate-50 font-medium">
              <td className="px-4 py-3" colSpan={3}>
                Bridged total
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{view.bridgedTotal}</td>
              <td className="px-4 py-3" colSpan={canEdit ? 2 : 1} />
            </tr>
            <tr className="border-b border-line font-medium">
              <td className="px-4 py-3" colSpan={3}>
                Register now ({reg.hardware.total} hardware + {reg.usbReaders} USB readers{reg.other ? ` + ${reg.other} other` : ""})
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{reg.total}</td>
              <td className="px-4 py-3" colSpan={canEdit ? 2 : 1} />
            </tr>
            <tr className={view.unexplained === 0 ? "" : "bg-amber-50"}>
              <td className="px-4 py-3 font-medium" colSpan={3}>
                Difference
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">{view.unexplained}</td>
              <td className="px-4 py-3 text-xs" colSpan={canEdit ? 2 : 1}>
                {view.unexplained === 0 ? "Balanced" : "To be confirmed"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {canEdit ? (
        editing === "new" ? (
          <LineForm
            initial={EMPTY_DRAFT}
            onCancel={() => setEditing(null)}
            onSubmit={async (draft) => {
              const err = await sendJson("/api/reports/reconciliation/lines", "POST", toPayload(draft));
              if (!err) {
                setEditing(null);
                onChanged();
              }
              return err;
            }}
          />
        ) : (
          <button type="button" className="btn-secondary py-2 text-xs" onClick={() => setEditing("new")}>
            Add line
          </button>
        )
      ) : null}
      <p className="text-xs text-muted">
        Written off: {reg.writtenOffWithCertificate} with a disposal certificate; {reg.pendingDisposal} pending disposal
        (no certificate yet). The difference is never forced to zero.
      </p>
    </section>
  );
}

function FieldCaptureCard({ view }: { view: ReconciliationView }) {
  const fc = view.fieldCapture;
  const b = fc.baseline;
  return (
    <section className="section-card space-y-3 p-5">
      <h3 className="font-heading text-base font-bold text-ink">Field capture</h3>
      <p className="text-sm text-muted">
        Baseline: {b.fileName}, exported {formatDate(b.exportDate)} — {b.terminalsAtClubs} terminals at clubs ({b.hnaOwned}{" "}
        HNA-owned, {b.clubOwned} club-owned, {b.blankOwnership} blank).
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className="h-full bg-brand" style={{ width: `${Math.min(100, fc.capturedPct)}%` }} />
      </div>
      <p className="text-sm text-ink">
        <strong>{fc.captured}</strong> of {b.hnaOwned} HNA-owned terminals captured ({fc.capturedPct}%);{" "}
        {fc.notYetCaptured} not yet captured.
      </p>
    </section>
  );
}

type AliasRow = { id: string; kind: string; alias: string; canonical: string; notes: string | null };

function ModelAliases({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<AliasRow[] | null>(null);
  const [draft, setDraft] = useState({ kind: "model", alias: "", canonical: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports/model-aliases");
      if (!res.ok) throw new Error("Could not load aliases");
      setRows((await res.json()) as AliasRow[]);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setError(null);
    const err = await sendJson("/api/reports/model-aliases", "POST", draft);
    if (err) return setError(err);
    setDraft({ kind: draft.kind, alias: "", canonical: "", notes: "" });
    void load();
  }

  async function remove(row: AliasRow) {
    if (!window.confirm(`Stop treating "${row.alias}" as ${row.canonical}?`)) return;
    const err = await sendJson(`/api/reports/model-aliases/${row.id}`, "DELETE");
    if (err) window.alert(err);
    else void load();
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading text-base font-bold text-ink">Names and aliases</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Alternative spellings counted as one model or brand in reports. Mecer is the brand, Mustek the company; Lenovo
          M810z and 10Q0 are never merged.
        </p>
      </div>
      {rows === null ? (
        <SectionSkeleton label="Loading aliases" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Spelling seen</th>
                <th className="px-4 py-2 font-medium">Counted as</th>
                <th className="px-4 py-2 font-medium">Notes</th>
                {canEdit ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line">
                  <td className="px-4 py-2 text-xs text-muted">{row.kind === "manufacturer" ? "Brand" : "Model"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.alias}</td>
                  <td className="px-4 py-2">{row.canonical}</td>
                  <td className="px-4 py-2 text-xs text-muted">{row.notes ?? ""}</td>
                  {canEdit ? (
                    <td className="px-4 py-2 text-right">
                      <button type="button" className="text-xs text-muted hover:underline" onClick={() => remove(row)}>
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit ? (
        <div className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_1fr_auto]">
          <select className="input-field px-2 py-1.5 text-sm" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
            <option value="model">Model</option>
            <option value="manufacturer">Brand</option>
          </select>
          <input className="input-field px-2 py-1.5 text-sm" placeholder="Spelling seen" value={draft.alias} onChange={(e) => setDraft({ ...draft, alias: e.target.value })} />
          <input className="input-field px-2 py-1.5 text-sm" placeholder="Count as" value={draft.canonical} onChange={(e) => setDraft({ ...draft, canonical: e.target.value })} />
          <input className="input-field px-2 py-1.5 text-sm" placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <button type="button" className="btn-primary py-1.5 text-xs" onClick={add}>
            Add alias
          </button>
          {error ? <p className="text-sm text-red-700 sm:col-span-5">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export default function ReconciliationTab() {
  const { role } = useAppRole();
  const canEdit = isReportsAdmin(role);
  const [view, setView] = useState<ReconciliationView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports/reconciliation");
      if (!res.ok) throw new Error("Could not load the reconciliation");
      setView((await res.json()) as ReconciliationView);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the reconciliation");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex-1">
          <TabIntro title="Reconciliation: prior count to system register">
            How the 31 January 2026 count of 132 becomes today&apos;s register, line by line; anything unexplained stays
            visible as &quot;to be confirmed&quot;.
          </TabIntro>
        </div>
        <PdfButtons open={PDF} download={`${PDF}?download=1`} compact />
      </div>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !view ? (
        <SectionSkeleton label="Loading reconciliation" />
      ) : (
        <>
          <Bridge view={view} canEdit={canEdit} onChanged={load} />
          <FieldCaptureCard view={view} />
        </>
      )}
      <ModelAliases canEdit={canEdit} />
    </div>
  );
}
