"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/dates/format";
import type { PeriodsOverview, PriorEventRow } from "@/lib/reports/period-records";
import { ReportsLifecycleSlot } from "./reports-lifecycle-slot";
import { TabIntro } from "./report-tile";

function PriorMovements() {
  const [events, setEvents] = useState<PriorEventRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/periods")
      .then((res) => (res.ok ? (res.json() as Promise<PeriodsOverview>) : null))
      .then((body) => {
        if (!cancelled) setEvents(body ? body.periods.flatMap((period) => period.events) : []);
      })
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!events) return [];
    if (!needle) return events;
    return events.filter(
      (event) =>
        event.serials.some((serial) => serial.toLowerCase().includes(needle)) ||
        event.assetLabel.toLowerCase().includes(needle) ||
        event.reference.toLowerCase().includes(needle)
    );
  }, [events, query]);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading text-base font-bold text-ink">Movements before this system</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Prior-company movements from vouchers and the Terminal Movement Report, found by serial, model or reference.
        </p>
      </div>
      <input
        className="input-field max-w-sm px-3 py-2 text-sm"
        placeholder="Serial, model or voucher reference"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {events === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-muted">No prior-company movement matches.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Serials</th>
                <th className="px-3 py-2 font-medium">From → to</th>
                <th className="px-3 py-2 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((event) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AssetsTab() {
  return (
    <div className="space-y-10">
      <TabIntro title="Asset history">
        Look up one asset by serial to see every stage change, with movements recorded before this system listed separately.
      </TabIntro>
      <ReportsLifecycleSlot />
      <PriorMovements />
    </div>
  );
}
