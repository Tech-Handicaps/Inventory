"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AssistDeviceRow = {
  resourceId: string;
  displayName: string;
  deviceName?: string;
};

type Props = {
  disabled?: boolean;
  onLink: (body: { resourceId: string }) => void | Promise<void>;
  linkLabel?: string;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function filterRowsByQuery(rows: AssistDeviceRow[], query: string): AssistDeviceRow[] {
  const q = norm(query);
  if (!q) return rows;
  const exact = rows.filter(
    (r) => norm(r.displayName) === q || (r.deviceName && norm(r.deviceName) === q)
  );
  if (exact.length > 0) return exact;
  return rows.filter(
    (r) =>
      norm(r.displayName).includes(q) ||
      (r.deviceName ? norm(r.deviceName).includes(q) : false)
  );
}

export function AssistDevicePicker({
  disabled,
  onLink,
  linkLabel = "Link to Assist",
}: Props) {
  const [tab, setTab] = useState<"name" | "browse">("name");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AssistDeviceRow[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [searched, setSearched] = useState(false);

  const visibleRows = useMemo(() => {
    if (tab === "browse") return rows;
    return filterRowsByQuery(rows, query);
  }, [tab, rows, query]);

  const loadList = useCallback(async (displayName?: string) => {
    setListBusy(true);
    setListError(null);
    setSelectedId("");
    try {
      const params = new URLSearchParams({ count: "50" });
      const q = displayName?.trim();
      if (q) params.set("display_name", q);
      const res = await fetch(`/api/zoho/assist/devices?${params}`);
      const j = (await res.json()) as { rows?: AssistDeviceRow[]; error?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "Could not list Assist devices");
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "List failed");
      setRows([]);
    } finally {
      setListBusy(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "browse") {
      void loadList();
    }
  }, [tab, loadList]);

  function switchTab(next: "name" | "browse") {
    setTab(next);
    setListError(null);
    setSelectedId("");
    setSearched(false);
    if (next === "name") {
      setRows([]);
    }
  }

  function runSearch() {
    const q = query.trim();
    if (!q || disabled) return;
    setSearched(true);
    void loadList(q);
  }

  const selectedRow = visibleRows.find((r) => r.resourceId === selectedId);

  return (
    <div className="space-y-3">
      <div className="flex border-b border-black/10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => switchTab("name")}
          className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
            tab === "name"
              ? "border-b-2 border-brand text-brand"
              : "text-black/50"
          }`}
        >
          Search by name
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => switchTab("browse")}
          className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
            tab === "browse"
              ? "border-b-2 border-brand text-brand"
              : "text-black/50"
          }`}
        >
          Browse list
        </button>
      </div>

      {tab === "name" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
                setSelectedId("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearch();
                }
              }}
              disabled={disabled}
              placeholder="Assist display name (e.g. HNA-DELMAS-01)"
              className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={disabled || !query.trim() || listBusy}
              onClick={runSearch}
              className="shrink-0 rounded-lg border border-black/15 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-black/70 disabled:opacity-50"
            >
              {listBusy ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="text-[11px] text-black/50">
            Search Assist devices, select the correct one, then click {linkLabel}.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-black/50">
          Select a device from your Assist department, then click {linkLabel}.
        </p>
      )}

      {listError ? (
        <p className="text-xs text-red-700" role="alert">
          {listError}
        </p>
      ) : null}

      {listBusy ? (
        <p className="py-4 text-center text-xs text-black/50">
          {tab === "name" ? "Searching Assist devices…" : "Loading devices…"}
        </p>
      ) : tab === "name" && !searched ? null : visibleRows.length === 0 ? (
        <p className="py-4 text-center text-xs text-black/50">
          {tab === "name"
            ? "No devices matched that name. Try a shorter search or browse the full list."
            : "No devices returned. Check Assist settings."}
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-black/10 p-1">
          {visibleRows.map((r) => (
            <li key={r.resourceId}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setSelectedId(r.resourceId)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                  selectedId === r.resourceId
                    ? "bg-violet-100 font-medium text-violet-950"
                    : "hover:bg-black/[0.04]"
                }`}
              >
                {r.displayName}
                {r.deviceName && r.deviceName !== r.displayName ? (
                  <span className="text-black/45"> · {r.deviceName}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedRow ? (
        <p className="text-[11px] text-black/60">
          Selected: <span className="font-medium text-black/80">{selectedRow.displayName}</span>
        </p>
      ) : null}

      <button
        type="button"
        disabled={disabled || !selectedId || listBusy}
        onClick={() => void onLink({ resourceId: selectedId })}
        className="font-heading w-full rounded-lg border-2 border-violet-600 bg-violet-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-violet-950 disabled:opacity-50"
      >
        {linkLabel}
      </button>
    </div>
  );
}
