"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { AUDIT_ACTION_TYPES } from "@/lib/audit/action-types";

type AuditRow = {
  id: string;
  actionType: string;
  userId: string | null;
  timestamp: string;
  notes: string | null;
  metadata: unknown;
};

const PAGE_SIZE = 50;

export function AuditLogSettingsSection() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionType, setActionType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterVersion, setFilterVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (actionType && actionType !== "all") {
        params.set("actionType", actionType);
      }
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Load failed");
      }
      const data = (await res.json()) as {
        items: AuditRow[];
        total: number;
      };
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit log");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, actionType, from, to]);

  useEffect(() => {
    load().catch(console.error);
  }, [load, filterVersion]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setFilterVersion((v) => v + 1);
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
          Audit log
        </h2>
        <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
        <p className="mt-4 text-sm leading-relaxed text-black/70">
          Immutable record of asset changes, device templates, repairs, and
          integration activity. Filter by action or date range.
        </p>
      </div>

      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-4 rounded-lg border border-black/10 bg-black/[0.02] p-4"
      >
        <div>
          <label className="block text-xs font-medium text-black/70">
            Action type
          </label>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="mt-1 min-w-[12rem] rounded-lg border border-black/15 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            {AUDIT_ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-black/70">
            From date
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-black/70">
            To date
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="font-heading rounded-lg bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-hover"
        >
          Apply filters
        </button>
      </form>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-black/55">Loading audit log…</p>
      ) : (
        <>
          <p className="text-xs text-black/55">
            {total === 0
              ? "No entries match your filters."
              : `Showing ${pageStart}–${pageEnd} of ${total}`}
          </p>

          <div className="overflow-x-auto rounded-lg border border-black/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-black/[0.03]">
                  <th className="py-2.5 pl-3 pr-2 font-medium">Time</th>
                  <th className="py-2.5 pr-2 font-medium">Action</th>
                  <th className="py-2.5 pr-2 font-medium">User</th>
                  <th className="py-2.5 pr-2 font-medium">Notes</th>
                  <th className="py-2.5 pr-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-black/5 align-top">
                      <td className="py-2.5 pl-3 pr-2 font-mono text-xs text-black/80 whitespace-nowrap">
                        {new Date(row.timestamp).toLocaleString("en-ZA", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-xs text-black">
                        {row.actionType}
                      </td>
                      <td className="max-w-[140px] truncate py-2.5 pr-2 font-mono text-xs text-black/70" title={row.userId ?? ""}>
                        {row.userId ?? "—"}
                      </td>
                      <td className="max-w-[200px] py-2.5 pr-2 text-black/80">
                        {row.notes ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((id) =>
                              id === row.id ? null : row.id
                            )
                          }
                          className="text-xs font-semibold uppercase text-brand hover:underline"
                        >
                          {expandedId === row.id ? "Hide" : "JSON"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === row.id ? (
                      <tr className="border-b border-black/5 bg-black/[0.02]">
                        <td colSpan={5} className="px-3 py-3">
                          <pre className="max-h-48 overflow-auto font-mono text-xs text-black/85">
                            {JSON.stringify(row.metadata ?? null, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="font-heading rounded-lg border border-black/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="font-heading rounded-lg border border-black/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
