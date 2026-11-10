"use client";

import { useEffect, useState } from "react";
import {
  reservationLabel,
  type ReplacementReservation,
} from "@/lib/finance/reservation-shared";

export type ReservableAsset = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  replacementReservation?: ReplacementReservation | null;
};

type Club = { id: string; name: string };

/**
 * "Send to club": reserve a New Stock / Refurbished unit for a club, or release an existing
 * reservation. The unit stays in its stock column with a Reserved tag until it appears in a
 * Zoho Assist import/link, then moves to Deployed and finance gets the dispatch notice.
 */
export function ReservationDialog({
  asset,
  onClose,
  onDone,
}: {
  asset: ReservableAsset;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const reservation = asset.replacementReservation ?? null;
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [clubId, setClubId] = useState("");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reservation) return;
    let cancelled = false;
    fetch("/api/clubs")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Could not load clubs (${r.status})`);
        return (await r.json()) as Club[];
      })
      .then((list) => {
        if (!cancelled) setClubs(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load clubs");
      });
    return () => {
      cancelled = true;
    };
  }, [reservation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const q = query.trim().toLowerCase();
  const visibleClubs = (clubs ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}/reservation`, {
        method: reservation ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reservation ? { reason } : { clubId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; clubName?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      onDone(
        reservation
          ? `${asset.assetName} is back in available stock.`
          : `${asset.assetName} reserved for ${j.clubName ?? "the club"}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && (reservation ? reason.trim().length > 0 : clubId.length > 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="reservation-title"
    >
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        aria-label="Cancel"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative w-full max-w-md rounded-t-lg border border-line bg-white p-5 sm:rounded-lg">
        <h2 id="reservation-title" className="text-base font-semibold text-ink">
          {reservation ? "Release reservation" : "Send to club"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {asset.assetName}
          {asset.serialNumber ? ` · S/N ${asset.serialNumber}` : ""}
        </p>

        {reservation ? (
          <div className="mt-4 space-y-3 text-sm text-ink">
            <p>
              Reserved for <strong>{reservationLabel(reservation)}</strong>. Releasing puts it back
              into available stock.
            </p>
            {reservation.certificateReference ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-950">
                This unit is the replacement on write-off {reservation.certificateReference}. The
                certificate keeps it on record; pick another unit for the club if needed.
              </p>
            ) : null}
            <label className="block">
              <span className="text-xs font-medium text-muted">Reason</span>
              <input
                className="input-field px-3 py-2 text-sm mt-1 w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. club no longer needs it"
                autoFocus
              />
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-ink">
            <p className="text-muted">
              The unit stays in stock with a <strong>Reserved</strong> tag. When it appears in a Zoho
              Assist import or is linked, it moves to Deployed and finance gets the dispatch notice.
            </p>
            <input
              className="input-field px-3 py-2 text-sm w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clubs…"
              aria-label="Search clubs"
              autoFocus
            />
            <div className="max-h-56 overflow-y-auto rounded-md border border-line">
              {clubs === null && !error ? (
                <p className="px-3 py-2 text-muted">Loading clubs…</p>
              ) : visibleClubs.length === 0 ? (
                <p className="px-3 py-2 text-muted">No clubs match.</p>
              ) : (
                visibleClubs.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-brand-muted/50 ${
                      clubId === c.id ? "bg-brand-muted" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="reserve-club"
                      checked={clubId === c.id}
                      onChange={() => setClubId(c.id)}
                    />
                    {c.name}
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {error ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" disabled={!canSubmit} onClick={() => void submit()} className="btn-primary">
            {busy ? "Saving…" : reservation ? "Release" : "Reserve for club"}
          </button>
        </div>
      </div>
    </div>
  );
}
