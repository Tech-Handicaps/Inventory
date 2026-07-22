"use client";

import { useEffect, useState } from "react";

type Asset = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  status: { code: string };
};

type Props = {
  asset: Asset | null;
  assessmentId?: string | null;
  assessmentReference?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function WriteOffModal({
  asset,
  assessmentId,
  assessmentReference,
  onClose,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [replacementRequested, setReplacementRequested] = useState(false);
  const [replacementNotes, setReplacementNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setReason("");
      setSerialNumber(asset.serialNumber ?? "");
      setReplacementRequested(false);
      setReplacementNotes("");
      setError(null);
    }
  }, [asset]);

  if (!asset) return null;

  const fromAssessment = asset.status.code === "assessment";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;

    const reasonTrimmed = reason.trim();
    if (!reasonTrimmed) {
      setError("Enter why this unit cannot be repaired or returned to service.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}/write-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reasonTrimmed,
          serialNumber: serialNumber.trim() || null,
          replacementRequested,
          replacementNotes: replacementRequested
            ? replacementNotes.trim() || undefined
            : undefined,
          assessmentId: fromAssessment ? assessmentId?.trim() || undefined : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : "Could not complete write-off"
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Write-off failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="write-off-title"
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
          id="write-off-title"
          className="font-heading text-lg font-bold uppercase tracking-wide text-black"
        >
          Write off (cannot repair)
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
            this write-off report closes the Assessment/Maintenance intake and
            notifies finance.
          </p>
        ) : asset.status.code === "repair" ? (
          <p className="mt-2 rounded-lg border border-orange-200/80 bg-orange-50 px-3 py-2 text-xs text-orange-950">
            Recording write-off from <strong>In Repairs</strong>. Finance will be
            notified with the details below.
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-black/70">
              Serial number
            </span>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
              placeholder="Confirm or enter serial"
            />
            <p className="mt-1 text-[11px] text-black/50">
              Confirm the unit being written off. Correct only if the registry
              serial was wrong.
            </p>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-black/70">
              Write-off reason <span className="text-red-600">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              placeholder="e.g. Motherboard failure — uneconomical to repair; physical damage beyond depot scope"
            />
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={replacementRequested}
              onChange={(e) => setReplacementRequested(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-black/80">
              Request a <strong>replacement</strong> unit for this site / club
            </span>
          </label>

          {replacementRequested ? (
            <label className="block">
              <span className="text-xs font-medium text-black/70">
                Replacement notes (optional)
              </span>
              <textarea
                value={replacementNotes}
                onChange={(e) => setReplacementNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                placeholder="Urgency, same model vs upgrade, club context…"
              />
            </label>
          ) : null}

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="font-heading rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Confirm write-off"}
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
