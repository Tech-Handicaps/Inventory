"use client";

import { useCallback, useEffect, useState } from "react";

type Asset = {
  id: string;
  assetName: string;
  serialNumber: string | null;
};

type DeskMeta = {
  canCreateTickets: boolean;
  configured: boolean;
};

type Props = {
  asset: Asset | null;
  onClose: () => void;
  onSuccess: () => void;
};

/** Modal: Deployed → Assessment/Maintenance lifecycle + optional Zoho Desk (matches POST /api/assessments) */
export function StartAssessmentModal({ asset, onClose, onSuccess }: Props) {
  const [intakeNotes, setIntakeNotes] = useState("");
  const [existingDeskTicket, setExistingDeskTicket] = useState("");
  const [createDeskTicket, setCreateDeskTicket] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desk, setDesk] = useState<DeskMeta | null>(null);

  const loadDesk = useCallback(async () => {
    const res = await fetch("/api/settings/zoho-desk");
    if (!res.ok) {
      setDesk({ canCreateTickets: false, configured: false });
      return;
    }
    const j = (await res.json()) as DeskMeta;
    setDesk({
      canCreateTickets: !!j.canCreateTickets,
      configured: !!j.configured,
    });
  }, []);

  useEffect(() => {
    if (asset) {
      setIntakeNotes("");
      setExistingDeskTicket("");
      setCreateDeskTicket(false);
      setError(null);
      loadDesk().catch(() =>
        setDesk({ canCreateTickets: false, configured: false })
      );
    }
  }, [asset, loadDesk]);

  useEffect(() => {
    if (existingDeskTicket.trim().length > 0) {
      setCreateDeskTicket(false);
    }
  }, [existingDeskTicket]);

  if (!asset) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const selected = asset;
    if (!selected) return;

    const linkTrimmed = existingDeskTicket.replace(/^#/, "").trim();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selected.id,
          intakeNotes: intakeNotes.trim() || undefined,
          createDeskTicket:
            linkTrimmed.length === 0 &&
            createDeskTicket &&
            (desk?.canCreateTickets ?? false),
          existingDeskTicket: linkTrimmed || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : "Could not start Assessment/Maintenance intake"
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const deskEnabled = desk?.canCreateTickets ?? false;
  const linking = existingDeskTicket.replace(/^#/, "").trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-assessment-maintenance-title"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-black/10 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="start-assessment-maintenance-title"
          className="font-heading text-lg font-bold uppercase tracking-wide text-black"
        >
          Send for Assessment/Maintenance
        </h2>
        <p className="mt-1 text-sm text-black/65">
          Moves this unit into triage or light maintenance (e.g. software reload, OS refresh) before
          a formal repair record if needed.

          <span className="ml-2">
            <span className="font-semibold text-black">{asset.assetName}</span>
          </span>
          {asset.serialNumber ? (
            <span className="ml-2 font-mono text-xs">
              S/N {asset.serialNumber}
            </span>
          ) : null}
        </p>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-black/70">
              Intake / triage notes (optional)
            </span>
            <textarea
              value={intakeNotes}
              onChange={(e) => setIntakeNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              placeholder="Symptoms, depot collection context, urgency, etc."
            />
          </label>

          {deskEnabled ? (
            <label className="block">
              <span className="text-xs font-medium text-black/70">
                Existing Zoho Desk ticket (optional)
              </span>
              <input
                type="text"
                value={existingDeskTicket}
                onChange={(e) => setExistingDeskTicket(e.target.value)}
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
                placeholder="Ticket id or URL fragment"
              />
              <p className="mt-1 text-[11px] leading-snug text-black/55">
                If set, intake context is appended as an <strong>internal</strong>
                Desk comment (not visible on the portal to the requester).
              </p>
            </label>
          ) : null}

          {deskEnabled ? (
            <label
              className={`flex items-start gap-2 ${linking ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={createDeskTicket}
                disabled={linking}
                onChange={(e) => {
                  setCreateDeskTicket(e.target.checked);
                  if (e.target.checked) setExistingDeskTicket("");
                }}
                className="mt-1"
              />
              <span className="text-sm text-black/80">
                Create a <strong>new</strong> Zoho Desk ticket for this intake
              </span>
            </label>
          ) : (
            <p className="rounded-lg bg-black/[0.04] px-3 py-2 text-xs text-black/55">
              Zoho Desk is not configured. Configure{" "}
              <strong>Settings → Zoho Desk API</strong> to link or create tickets
              from here.
            </p>
          )}

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="font-heading rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : "Start intake"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/15 px-5 py-2.5 text-sm font-medium text-black/80 hover:bg-black/[0.04]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
