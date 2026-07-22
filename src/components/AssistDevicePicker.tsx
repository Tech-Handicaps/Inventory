"use client";

import { useCallback, useEffect, useState } from "react";

export type AssistDeviceRow = {
  resourceId: string;
  displayName: string;
  deviceName?: string;
};

type Props = {
  disabled?: boolean;
  onLink: (body: { resourceId?: string; displayName?: string }) => void | Promise<void>;
  linkLabel?: string;
};

export function AssistDevicePicker({
  disabled,
  onLink,
  linkLabel = "Link selected device",
}: Props) {
  const [tab, setTab] = useState<"name" | "browse">("name");
  const [displayName, setDisplayName] = useState("");
  const [rows, setRows] = useState<AssistDeviceRow[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const loadList = useCallback(async () => {
    setListBusy(true);
    setListError(null);
    try {
      const res = await fetch("/api/zoho/assist/devices?count=50");
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

  return (
    <div className="space-y-3">
      <div className="flex border-b border-black/10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTab("name")}
          className={`flex-1 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide ${
            tab === "name"
              ? "border-b-2 border-brand text-brand"
              : "text-black/50"
          }`}
        >
          By name
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTab("browse")}
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
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const q = displayName.trim();
            if (!q || disabled) return;
            void onLink({ displayName: q });
          }}
        >
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={disabled}
            placeholder="Assist display name (e.g. HNA-DELMAS-01)"
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={disabled || !displayName.trim()}
            className="font-heading w-full rounded-lg border-2 border-violet-600 bg-violet-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-violet-950 disabled:opacity-50"
          >
            {linkLabel} by name
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          {listError ? (
            <p className="text-xs text-red-700" role="alert">
              {listError}
            </p>
          ) : null}
          {listBusy ? (
            <p className="py-4 text-center text-xs text-black/50">Loading devices…</p>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-xs text-black/50">
              No devices returned. Check Assist settings.
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-black/10 p-1">
              {rows.map((r) => (
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
          <button
            type="button"
            disabled={disabled || !selectedId}
            onClick={() => void onLink({ resourceId: selectedId })}
            className="font-heading w-full rounded-lg border-2 border-violet-600 bg-violet-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-violet-950 disabled:opacity-50"
          >
            {linkLabel}
          </button>
        </div>
      )}
    </div>
  );
}
