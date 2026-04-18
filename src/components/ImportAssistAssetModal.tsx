"use client";

import { useCallback, useEffect, useState } from "react";

type AssistRow = {
  resourceId: string;
  displayName: string;
  deviceName?: string;
};

type NoTemplatePayload = {
  code: string;
  resourceId: string;
  mapped: {
    assetName?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    deviceLocation?: string | null;
    processorName?: string | null;
    systemRam?: string | null;
    systemGpu?: string | null;
  };
  suggestedTemplate: {
    label: string;
    manufacturer: string;
    model: string;
    category: string;
  };
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function ImportAssistAssetModal({ open, onClose, onImported }: Props) {
  const [tab, setTab] = useState<"name" | "browse">("name");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [rows, setRows] = useState<AssistRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [noTpl, setNoTpl] = useState<NoTemplatePayload | null>(null);
  const [tplCategory, setTplCategory] = useState("Hardware");

  const reset = useCallback(() => {
    setFormError(null);
    setListError(null);
    setNoTpl(null);
    setTplCategory("Hardware");
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    setTab("name");
    setDisplayName("");
    setRows([]);
  }, [open, reset]);

  const loadList = useCallback(async () => {
    setListBusy(true);
    setListError(null);
    try {
      const res = await fetch("/api/zoho/assist/devices?count=50");
      const j = (await res.json()) as { rows?: AssistRow[]; error?: string };
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
    if (open && tab === "browse") {
      void loadList();
    }
  }, [open, tab, loadList]);

  async function runImport(body: Record<string, unknown>) {
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/assets/import-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        if (text) data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        setFormError("Invalid server response");
        return;
      }

      if (res.status === 409 && data.code === "NO_MATCHING_DEVICE_TEMPLATE") {
        setNoTpl(data as unknown as NoTemplatePayload);
        return;
      }
      if (res.status === 409 && data.code === "DEVICE_ALREADY_IMPORTED") {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "This Assist device is already on the board.";
        setFormError(
          typeof data.assetId === "string" ? `${msg} (asset id: ${data.assetId})` : msg
        );
        return;
      }
      if (!res.ok) {
        setFormError(
          typeof data.error === "string" ? data.error : `Import failed (${res.status})`
        );
        return;
      }
      setNoTpl(null);
      onImported();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function submitByName(e: React.FormEvent) {
    e.preventDefault();
    const q = displayName.trim();
    if (!q) {
      setFormError("Enter the device display name as it appears in Zoho Assist.");
      return;
    }
    void runImport({ displayName: q });
  }

  function importRow(r: AssistRow) {
    void runImport({ resourceId: r.resourceId });
  }

  async function confirmNoTemplate(mode: "skip" | "create") {
    if (!noTpl) return;
    if (mode === "skip") {
      await runImport({
        resourceId: noTpl.resourceId,
        acceptWithoutTemplate: true,
      });
      return;
    }
    await runImport({
      resourceId: noTpl.resourceId,
      createTemplate: true,
      templateCategory: tplCategory.trim() || "Hardware",
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assist-import-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !noTpl) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-black/10 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-black/10 px-5 py-4">
          <h2
            id="assist-import-title"
            className="font-heading text-lg font-bold uppercase tracking-wide text-black"
          >
            Import from Zoho Assist
          </h2>
          <p className="mt-1 text-xs text-black/60">
            Requires saved Assist OAuth credentials and a default department id in Settings.
          </p>
        </div>

        <div className="flex border-b border-black/10 px-2">
          <button
            type="button"
            onClick={() => setTab("name")}
            className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wide ${
              tab === "name"
                ? "border-b-2 border-brand text-brand"
                : "text-black/50"
            }`}
          >
            By device name
          </button>
          <button
            type="button"
            onClick={() => setTab("browse")}
            className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wide ${
              tab === "browse"
                ? "border-b-2 border-brand text-brand"
                : "text-black/50"
            }`}
          >
            Browse Assist devices
          </button>
        </div>

        <div className="px-5 py-4">
          {formError ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          {tab === "name" ? (
            <form onSubmit={submitByName} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-black/70">
                  Device display name (Assist)
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. HNA-AKASIACC-01"
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-black/50">
                  Must match the unattended device name / display name in Zoho Assist.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="font-heading rounded-lg bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {busy ? "Importing…" : "Import device"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-heading rounded-lg border border-black/20 px-4 py-2 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {listBusy ? (
                <p className="text-sm text-black/55">Loading devices…</p>
              ) : listError ? (
                <p className="text-sm text-red-800">{listError}</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-black/55">No devices returned for this department.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                  {rows.map((r) => (
                    <li
                      key={r.resourceId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.displayName}</p>
                        {r.deviceName && r.deviceName !== r.displayName ? (
                          <p className="truncate text-xs text-black/50">{r.deviceName}</p>
                        ) : null}
                        <p className="font-mono text-[10px] text-black/40">{r.resourceId}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => importRow(r)}
                        className="shrink-0 rounded bg-brand px-2 py-1 text-[10px] font-bold uppercase text-white disabled:opacity-50"
                      >
                        Import
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => void loadList()}
                className="text-xs font-semibold text-brand underline"
              >
                Refresh list
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 block font-heading text-xs font-bold uppercase text-black/60"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {noTpl ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-xl">
            <h3 className="font-heading text-sm font-bold uppercase text-amber-950">
              No device template match
            </h3>
            <p className="mt-2 text-sm text-amber-950/95">
              This device is not covered by a{" "}
              <strong className="font-semibold">Device template</strong> (make/model) in Settings.
              Manufacturer:{" "}
              <strong>{noTpl.mapped.manufacturer || "—"}</strong>, model:{" "}
              <strong>{noTpl.mapped.model || "—"}</strong>.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-black/70">
                Category if creating a template
              </label>
              <input
                value={tplCategory}
                onChange={(e) => setTplCategory(e.target.value)}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                placeholder="Hardware, Laptop, …"
              />
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmNoTemplate("create")}
                className="font-heading rounded-lg bg-brand px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
              >
                Create template &amp; import
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmNoTemplate("skip")}
                className="font-heading rounded-lg border border-amber-800/40 bg-white px-4 py-2 text-xs font-bold uppercase text-amber-950 disabled:opacity-50"
              >
                Import without template
              </button>
              <button
                type="button"
                onClick={() => setNoTpl(null)}
                className="font-heading rounded-lg px-4 py-2 text-xs font-bold uppercase text-black/70"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
