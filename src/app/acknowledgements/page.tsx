"use client";

import { useCallback, useEffect, useState } from "react";
import { InventoryHeader } from "@/components/InventoryHeader";

function makeModelLine(manufacturer: string | null, model: string | null): string | null {
  const parts = [manufacturer?.trim(), model?.trim()].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

type Row = {
  id: string;
  eventType: string;
  status: string;
  referenceText: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedNote: string | null;
  emailSentAt: string | null;
  emailSkippedReason: string | null;
  emailError: string | null;
  asset: {
    id: string;
    assetName: string;
    category: string;
    serialNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    reason: string | null;
  };
  repair: { referenceNumber: string } | null;
};

export default function AcknowledgementsPage() {
  const [filter, setFilter] = useState<"pending" | "acknowledged" | "all">(
    "pending"
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const q =
      filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
    const res = await fetch(`/api/finance/acknowledgements${q}`, {
      cache: "no-store",
    });
    const j = (await res.json().catch(() => ({}))) as {
      items?: Row[];
      error?: string;
    };
    if (!res.ok) {
      throw new Error(j.error ?? "Failed to load");
    }
    setRows(Array.isArray(j.items) ? j.items : []);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  async function acknowledge(id: string) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/finance/acknowledgements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledgedNote: noteById[id]?.trim() || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Acknowledge failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="acknowledgements" />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="font-heading text-xl font-bold uppercase tracking-wide text-black">
            Finance acknowledgements
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-black/65">
            When a device is logged for repair or written off, a row appears here
            for finance to confirm their records are updated. Email notifications
            are optional (configure under Settings → Email &amp; finance).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pending", "Pending"],
              ["acknowledged", "Acknowledged"],
              ["all", "All"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === v
                  ? "bg-brand text-white"
                  : "border border-black/15 bg-white text-black/75 hover:bg-black/[0.04]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.03]">
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Acknowledge</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-black/45">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-black/45">
                    No items.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const makeModel = makeModelLine(
                    r.asset.manufacturer,
                    r.asset.model
                  );
                  return (
                  <tr key={r.id} className="border-b border-black/5">
                    <td className="px-4 py-3 align-top">
                      <span className="font-medium capitalize">
                        {r.eventType.replace("_", " ")}
                      </span>
                      <div className="text-xs text-black/45">
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div>{r.asset.assetName}</div>
                      <div className="text-xs text-black/55">
                        {r.asset.category}
                      </div>
                      {makeModel ? (
                        <div className="text-xs text-black/55">{makeModel}</div>
                      ) : null}
                      {r.asset.serialNumber ? (
                        <div className="text-xs text-black/50">
                          Serial: {r.asset.serialNumber}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs">
                      {r.repair?.referenceNumber ?? r.referenceText ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-black/60">
                      {r.emailSentAt
                        ? `Sent ${new Date(r.emailSentAt).toLocaleString()}`
                        : r.emailSkippedReason
                          ? `Skipped: ${r.emailSkippedReason}`
                          : r.emailError
                            ? `Error: ${r.emailError.slice(0, 80)}`
                            : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {r.status === "acknowledged" ? (
                        <span className="text-sm text-brand">
                          Done
                          {r.acknowledgedAt
                            ? ` · ${new Date(r.acknowledgedAt).toLocaleString()}`
                            : ""}
                        </span>
                      ) : (
                        <div className="flex max-w-xs flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Optional note (e.g. Xero updated)"
                            value={noteById[r.id] ?? ""}
                            onChange={(e) =>
                              setNoteById((m) => ({
                                ...m,
                                [r.id]: e.target.value,
                              }))
                            }
                            className="w-full rounded border border-black/15 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            disabled={savingId === r.id}
                            onClick={() => void acknowledge(r.id)}
                            className="font-heading rounded-lg bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-hover disabled:opacity-50"
                          >
                            {savingId === r.id ? "Saving…" : "Acknowledge"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
