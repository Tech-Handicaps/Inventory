"use client";

import { useCallback, useEffect, useState } from "react";
import { HardwareCaptureForm } from "@/components/HardwareCaptureForm";
import { InventoryHeader } from "@/components/InventoryHeader";

type Asset = {
  id: string;
  assetName: string;
  category: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  dataSource: string;
  deviceLocation: string | null;
  processorName: string | null;
  systemRam: string | null;
  systemGpu: string | null;
  zohoAssistDeviceId: string | null;
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

  const load = useCallback(async () => {
    const [aRes, sRes] = await Promise.all([
      fetch("/api/assets"),
      fetch("/api/statuses"),
    ]);
    const a = await aRes.json();
    const s = await sRes.json();
    setAssets(a.assets ?? []);
    setStatuses(Array.isArray(s) ? s : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

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

      <main className="mx-auto max-w-6xl space-y-8 p-6">
        <HardwareCaptureForm statuses={statuses} onCreated={() => load()} />

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
            All assets
          </h2>
          <div className="mt-2 h-0.5 w-14 rounded-full bg-brand" />
          <p className="mt-4 max-w-3xl text-sm text-black/70">
            The table lists every unit. Use <strong>Register hardware</strong>{" "}
            above to add one <strong>physical unit</strong> at a time. Pick a{" "}
            <strong>device template</strong> (from Settings) so you don’t retype
            the same make/model — you still enter this unit’s{" "}
            <strong>serial</strong> and optional display name so each row is
            unique. Rows synced from Zoho Assist show <strong>Source: Assist</strong>{" "}
            and hardware details when populated.
          </p>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          {assets.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="py-2 text-left font-medium">Name</th>
                    <th className="py-2 text-left font-medium">Source</th>
                    <th className="py-2 text-left font-medium">Category</th>
                    <th className="py-2 text-left font-medium">Manufacturer</th>
                    <th className="py-2 text-left font-medium">Model</th>
                    <th className="py-2 text-left font-medium">Serial</th>
                    <th className="py-2 text-left font-medium">Location</th>
                    <th className="py-2 text-left font-medium">CPU / RAM / GPU</th>
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
                      <td className="py-2 text-xs">
                        {a.dataSource === "zoho_assist" ? (
                          <span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-900">
                            Assist
                          </span>
                        ) : (
                          "Manual"
                        )}
                      </td>
                      <td className="py-2">{a.category}</td>
                      <td className="py-2">{a.manufacturer ?? "—"}</td>
                      <td className="py-2">{a.model ?? "—"}</td>
                      <td className="py-2 font-mono text-xs">
                        {a.serialNumber ?? "—"}
                      </td>
                      <td className="max-w-[140px] py-2 text-xs text-black/70">
                        {a.deviceLocation ?? "—"}
                      </td>
                      <td className="max-w-[200px] py-2 text-xs text-black/70">
                        {[a.processorName, a.systemRam, a.systemGpu]
                          .filter(Boolean)
                          .join(" · ") || "—"}
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
              No assets yet. Use the form above to register hardware.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
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
