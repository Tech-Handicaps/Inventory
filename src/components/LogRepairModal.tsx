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
  /** When the asset is in Assessment/Maintenance, links the open intake record (required by API). */
  assessmentId?: string | null;
  assessmentReference?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function LogRepairModal({
  asset,
  assessmentId,
  assessmentReference,
  onClose,
  onSuccess,
}: Props) {
  const [notes, setNotes] = useState("");
  const [existingDeskTicket, setExistingDeskTicket] = useState("");
  const [createDeskTicket, setCreateDeskTicket] = useState(false);
  const [moveToRepair, setMoveToRepair] = useState(true);
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
      setNotes("");
      setExistingDeskTicket("");
      setCreateDeskTicket(false);
      setMoveToRepair(true);
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
    if (!asset) return;
    const linkTrimmed = existingDeskTicket.replace(/^#/, "").trim();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          assessmentId: assessmentId?.trim() || undefined,
          technicianNotes: notes.trim() || undefined,
          repairStatus: "pending",
          createDeskTicket:
            linkTrimmed.length === 0 && createDeskTicket && (desk?.canCreateTickets ?? false),
          existingDeskTicket: linkTrimmed || undefined,
          moveAssetToRepairStage: moveToRepair,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : "Could not log repair"
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
      aria-labelledby="log-repair-title"
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
          id="log-repair-title"
          className="font-heading text-lg font-bold uppercase tracking-wide text-black"
        >
          Log repair
        </h2>
        <p className="mt-1 text-sm text-black/65">
          {asset.assetName}
          {asset.serialNumber ? (
            <span className="ml-2 font-mono text-xs">
              S/N {asset.serialNumber}
            </span>
          ) : null}
        </p>
        {assessmentReference?.trim() ? (
          <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Completing intake{" "}
            <span className="font-mono font-semibold">
              {assessmentReference.trim()}
            </span>
            {" — "}
              a formal repair record will close this Assessment/Maintenance intake.
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-black/70">
              Technician notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              placeholder="Fault, parts requested, etc."
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
                placeholder="e.g. 12345 or long id from the ticket URL"
              />
              <p className="mt-1 text-[11px] leading-snug text-black/55">
                If you enter a ticket, this repair is linked to it and we{" "}
                <strong>do not</strong> create a new Desk ticket. Technician notes
                (and a short inventory summary) are posted as an{" "}
                <strong>internal</strong> Desk comment — not visible to the
                requester on the portal.
              </p>
            </label>
          ) : null}

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={moveToRepair}
              onChange={(e) => setMoveToRepair(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-black/80">
              Move asset to <strong>In Repairs</strong> lifecycle stage
            </span>
          </label>

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
                Create a <strong>new</strong> Zoho Desk ticket (includes
                inventory reference in the description)
              </span>
            </label>
          ) : (
            <p className="rounded-lg bg-black/[0.04] px-3 py-2 text-xs text-black/55">
              Zoho Desk ticketing is not configured. Add org id and OAuth in{" "}
              <strong>Settings → Zoho Desk API</strong> to enable linking or new
              tickets.
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
              {saving ? "Saving…" : "Create repair record"}
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
