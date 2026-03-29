"use client";

import { useEffect, useState } from "react";
import { InventoryHeader } from "@/components/InventoryHeader";

type Asset = {
  id: string;
  assetName: string;
  category: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  status: { code: string; label: string };
  deviceTemplate?: { id: string; label: string } | null;
  reason: string | null;
  dateAdded: string;
  dateUpdated: string;
};
type Status = { id: string; code: string; label: string };

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/assets").then((r) => r.json()),
      fetch("/api/statuses").then((r) => r.json()),
    ])
      .then(([a, s]) => {
        setAssets(a.assets ?? []);
        setStatuses(s ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-black/55">Loading assets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="assets" />

      <main className="mx-auto max-w-6xl p-6">
        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            All assets
          </h2>
          <div className="mt-2 h-0.5 w-14 rounded-full bg-brand" />
          {assets.length ? (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="py-2 text-left font-medium">Name</th>
                    <th className="py-2 text-left font-medium">Category</th>
                    <th className="py-2 text-left font-medium">Manufacturer</th>
                    <th className="py-2 text-left font-medium">Model</th>
                    <th className="py-2 text-left font-medium">Serial</th>
                    <th className="py-2 text-left font-medium">Template</th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-left font-medium">Reason</th>
                    <th className="py-2 text-left font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} className="border-b border-black/5">
                      <td className="py-2">{a.assetName}</td>
                      <td className="py-2">{a.category}</td>
                      <td className="py-2">{a.manufacturer ?? "—"}</td>
                      <td className="py-2">{a.model ?? "—"}</td>
                      <td className="py-2 font-mono text-xs">
                        {a.serialNumber ?? "—"}
                      </td>
                      <td className="py-2 text-xs text-black/70">
                        {a.deviceTemplate?.label ?? "—"}
                      </td>
                      <td className="py-2">{a.status?.label ?? "—"}</td>
                      <td className="py-2">{a.reason ?? "—"}</td>
                      <td className="py-2">
                        {new Date(a.dateUpdated).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-black/50">
              No assets. Add via API or seed data.
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h3 className="font-heading mb-2 text-sm font-bold uppercase tracking-wide text-black">
            Lifecycle states (extensible)
          </h3>
          <p className="text-xs text-black/55">
            Add rows to AssetStatus table to load additional states.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {statuses.map((s) => (
              <li
                key={s.id}
                className="rounded border border-black/10 bg-brand-muted px-2 py-1 text-xs font-medium text-black/80"
              >
                {s.label} ({s.code})
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
