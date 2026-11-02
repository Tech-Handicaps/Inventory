"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppRole } from "@/components/RoleProvider";
import { SectionSkeleton } from "@/components/Skeleton";
import { isReportsAdmin } from "@/lib/auth/reports-admin";
import { formatDate } from "@/lib/dates/format";
import { markdownToHtml } from "@/lib/markdown/simple-markdown";
import { buildAuditorIndex } from "@/lib/reports/auditor-index";
import type { AuditorNotes } from "@/lib/reports/auditor-notes";
import { PdfButtons } from "./report-tile";
import type { ReportsTabId } from "./tabs";

const AUDITOR_PDF = "/api/reports/auditor-index/pdf";

const CARDS: { tab: ReportsTabId; title: string; body: string }[] = [
  {
    tab: "monthly",
    title: "Monthly finance pack",
    body: "The stored pack emailed to finance each month: reconcile, breakdown, field listing and CSV.",
  },
  {
    tab: "stock",
    title: "Stock count",
    body: "Printable lists of what is on the register today, for a physical count.",
  },
  {
    tab: "assets",
    title: "Asset history",
    body: "Every move of one asset by serial, including movements recorded before this system.",
  },
];

function NotesEditor({
  notes,
  onSaved,
  onCancel,
}: {
  notes: AuditorNotes;
  onSaved: (notes: AuditorNotes) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(notes.title);
  const [markdown, setMarkdown] = useState(notes.markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, markdown, expectedVersion: notes.version }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<AuditorNotes> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save the notes");
      onSaved(body as AuditorNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the notes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-ink">
        Title
        <input className="input-field mt-1 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-ink">
        Notes (Markdown: # headings, - lists, **bold**, | tables |)
        <textarea
          className="input-field mt-1 min-h-[320px] px-3 py-2 font-mono text-xs"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : `Save as version ${notes.version + 1}`}
        </button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function NotesForAuditors() {
  const { role } = useAppRole();
  const canEdit = isReportsAdmin(role);
  const [notes, setNotes] = useState<AuditorNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/notes")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load the notes");
        return (await res.json()) as AuditorNotes;
      })
      .then((body) => !cancelled && setNotes(body))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the notes"));
    return () => {
      cancelled = true;
    };
  }, []);

  const html = useMemo(() => (notes ? markdownToHtml(notes.markdown) : ""), [notes]);
  const onSaved = useCallback((saved: AuditorNotes) => {
    setNotes(saved);
    setEditing(false);
  }, []);

  return (
    <section id="notes" className="section-card space-y-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">{notes?.title ?? "Notes for auditors and finance"}</h2>
          <p className="mt-1 text-xs text-muted">
            {notes
              ? notes.version > 0
                ? `Version ${notes.version} · last updated ${formatDate(notes.updatedAt)}`
                : "Draft — not yet saved by an administrator"
              : " "}
            {" · "}Printed as page 1 of every PDF covering a month before October 2026.
          </p>
        </div>
        {canEdit && notes && !editing ? (
          <button type="button" className="btn-secondary py-2 text-xs" onClick={() => setEditing(true)}>
            Edit notes
          </button>
        ) : null}
      </header>
      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !notes ? (
        <SectionSkeleton label="Loading notes" />
      ) : editing ? (
        <NotesEditor notes={notes} onSaved={onSaved} onCancel={() => setEditing(false)} />
      ) : (
        <div className="notes-body max-w-3xl text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </section>
  );
}

function AuditorIndex({ onOpenTab }: { onOpenTab: (tab: ReportsTabId) => void }) {
  const index = buildAuditorIndex();
  return (
    <section id="auditor-index" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-ink">Auditor index</h2>
          <p className="mt-1 text-sm text-muted">Where each document for an audit is kept, and what it covers.</p>
        </div>
        <PdfButtons open={AUDITOR_PDF} download={`${AUDITOR_PDF}?download=1`} compact />
      </header>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Open this</th>
              <th className="px-4 py-3 font-medium">What it covers</th>
            </tr>
          </thead>
          <tbody>
            {index.entries.map((entry) => {
              const tab = new URLSearchParams(entry.href.replace(/^\?/, "")).get("tab") as ReportsTabId | null;
              return (
                <tr key={entry.href} className="border-b border-line">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    <a
                      href={entry.href}
                      className="text-brand-deep hover:underline"
                      onClick={(e) => {
                        if (!tab) return;
                        e.preventDefault();
                        onOpenTab(tab);
                      }}
                    >
                      {entry.title}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-ink">{entry.covers}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="section-card p-5">
        <summary className="cursor-pointer font-heading text-sm font-bold text-ink">About older data</summary>
        <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-ink">
          {index.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <h3 className="pt-2 font-heading text-sm font-bold">Why Service Desk Reports are supporting documents only</h3>
          <ul className="list-disc space-y-1 pl-5">
            {index.serviceDeskDiscrepancies.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}

export default function StartTab({ onOpenTab }: { onOpenTab: (tab: ReportsTabId) => void }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="which-report" className="space-y-3">
        <h2 id="which-report" className="font-heading text-lg font-bold text-ink">
          Which report do I need?
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map((card) => (
            <button
              key={card.tab}
              type="button"
              onClick={() => onOpenTab(card.tab)}
              className="section-card section-card-interactive flex flex-col gap-2 p-5 text-left"
            >
              <span className="font-heading text-sm font-bold text-ink">{card.title}</span>
              <span className="text-sm leading-relaxed text-muted">{card.body}</span>
              <span className="mt-auto pt-2 text-sm font-medium text-brand-deep">Open →</span>
            </button>
          ))}
        </div>
      </section>
      <NotesForAuditors />
      <AuditorIndex onOpenTab={onOpenTab} />
    </div>
  );
}
