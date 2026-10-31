"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AssistRow = {
  resourceId: string;
  displayName: string;
  deviceName?: string;
};

type ClubAsset = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  dataSource: string;
  zohoAssistDeviceId: string | null;
  status: { code: string; label: string };
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
  const [duplicateAssetId, setDuplicateAssetId] = useState<string | null>(null);

  const [noTpl, setNoTpl] = useState<NoTemplatePayload | null>(null);
  const [tplCategory, setTplCategory] = useState("Hardware");
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubId, setClubId] = useState("");
  const [clubAssets, setClubAssets] = useState<ClubAsset[]>([]);
  const [clubAssetsLoading, setClubAssetsLoading] = useState(false);
  const [clubAssetsError, setClubAssetsError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFormError(null);
    setDuplicateAssetId(null);
    setListError(null);
    setNoTpl(null);
    setTplCategory("Hardware");
    setClubId("");
    setClubAssets([]);
    setClubAssetsError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    setTab("name");
    setDisplayName("");
    setRows([]);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setClubsLoading(true);
    fetch("/api/clubs")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load clubs");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setClubs(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setClubs([]);
          setFormError(
            e instanceof Error ? e.message : "Failed to load clubs"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setClubsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !clubId.trim()) {
      setClubAssets([]);
      setClubAssetsError(null);
      setClubAssetsLoading(false);
      return;
    }

    let cancelled = false;
    setClubAssetsLoading(true);
    setClubAssetsError(null);

    fetch(`/api/assets?clubId=${encodeURIComponent(clubId.trim())}&limit=500`)
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            typeof j.error === "string" ? j.error : "Could not load club assets"
          );
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const assets = Array.isArray(data.assets) ? data.assets : [];
        setClubAssets(
          assets
            .map((a: ClubAsset) => a)
            .sort((a: ClubAsset, b: ClubAsset) =>
              a.assetName.localeCompare(b.assetName)
            )
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setClubAssets([]);
          setClubAssetsError(
            e instanceof Error ? e.message : "Could not load club assets"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setClubAssetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, clubId]);

  const matchingClubAsset = useMemo(() => {
    const q = displayName.trim().toLowerCase();
    if (!q || clubAssets.length === 0) return null;
    return (
      clubAssets.find((a) => a.assetName.trim().toLowerCase() === q) ?? null
    );
  }, [displayName, clubAssets]);

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
      const payload = {
        ...body,
        ...(clubId.trim() ? { clubId: clubId.trim() } : {}),
      };
      const res = await fetch("/api/assets/import-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        setDuplicateAssetId(
          typeof data.assetId === "string" ? data.assetId : null
        );
        return;
      }
      if (res.status === 409 && data.code === "DUPLICATE_SERIAL") {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "This serial number is already registered in inventory.";
        setFormError(msg);
        setDuplicateAssetId(
          typeof data.assetId === "string" ? data.assetId : null
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
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assist-import-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !noTpl) onClose();
      }}
    >
      <div
        className="modal-panel max-h-[90vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-5 py-4">
          <h2
            id="assist-import-title"
            className="font-heading text-lg font-bold text-ink"
          >
            Import from Zoho Assist
          </h2>
          <p className="mt-1 text-xs text-muted">
            Requires saved Assist OAuth credentials and a default department id in Settings.
          </p>
        </div>

        <div className="flex border-b border-line px-2">
          <button
            type="button"
            onClick={() => setTab("name")}
            className={`flex-1 px-3 py-2 text-xs font-bold ${
              tab === "name"
                ? "border-b-2 border-brand text-brand-deep"
                : "text-muted"
            }`}
          >
            By device name
          </button>
          <button
            type="button"
            onClick={() => setTab("browse")}
            className={`flex-1 px-3 py-2 text-xs font-bold ${
              tab === "browse"
                ? "border-b-2 border-brand text-brand-deep"
                : "text-muted"
            }`}
          >
            Browse Assist devices
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4">
            <label className="text-xs font-medium text-ink">
              Club name (optional)
            </label>
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              disabled={clubsLoading}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="">
                {clubsLoading ? "Loading clubs…" : "— None —"}
              </option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {clubId ? (
              <ClubAssignedAssetsPanel
                loading={clubAssetsLoading}
                error={clubAssetsError}
                assets={clubAssets}
                matchingAsset={matchingClubAsset}
              />
            ) : null}
          </div>
          {formError ? (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              role="alert"
            >
              <p>{formError}</p>
              {duplicateAssetId ? (
                <p className="mt-3 border-t border-red-200/80 pt-3 text-red-950/95">
                  {formError?.includes("Serial number") ? (
                    <>
                      Open the existing asset, click <strong>Edit</strong>, and use{" "}
                      <strong>Link to Assist</strong> in the Zoho Assist section — your
                      registry serial is kept. Or unlink/correct the serial on one row if
                      these are different machines.
                    </>
                  ) : (
                    <>
                      It is already saved in this app’s database (not re-fetched from Assist).
                    </>
                  )}{" "}
                  <Link
                    href="/assets"
                    className="font-semibold text-brand-deep underline hover:no-underline"
                  >
                    Open All assets
                  </Link>{" "}
                  or{" "}
                  <Link
                    href="/inventory"
                    className="font-semibold text-brand-deep underline hover:no-underline"
                  >
                    Hardware board
                  </Link>{" "}
                  and search by name or serial. If those lists look empty, refresh the page or ask an
                  admin — your account may not have permission to load assets.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "name" ? (
            <form onSubmit={submitByName} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink">
                  Device display name (Assist)
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. HNA-AKASIACC-01"
                  className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted">
                  Must match the unattended device name / display name in Zoho Assist.
                </p>
                {matchingClubAsset ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
                    <strong>{matchingClubAsset.assetName}</strong> is already assigned
                    to this club
                    {matchingClubAsset.serialNumber
                      ? ` (S/N ${matchingClubAsset.serialNumber})`
                      : ""}
                    . Import will likely fail as a duplicate — use{" "}
                    <strong>Link to Assist</strong> on the existing asset instead.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary"
                >
                  {busy ? "Importing…" : "Import device"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-heading rounded-lg border border-black/20 px-4 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {listBusy ? (
                <p className="text-sm text-muted">Loading devices…</p>
              ) : listError ? (
                <p className="text-sm text-red-800">{listError}</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted">No devices returned for this department.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                  {rows.map((r) => (
                    <li
                      key={r.resourceId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-black/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.displayName}</p>
                        {r.deviceName && r.deviceName !== r.displayName ? (
                          <p className="truncate text-xs text-muted">{r.deviceName}</p>
                        ) : null}
                        <p className="font-mono text-xs text-muted">{r.resourceId}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => importRow(r)}
                        className="shrink-0 rounded bg-hna-green-strong px-2 py-1 text-xs font-bold text-white hover:bg-hna-green-hover disabled:opacity-50"
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
                className="text-xs font-semibold text-brand-deep underline"
              >
                Refresh list
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 block font-heading text-xs font-bold text-muted"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {noTpl ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-xl">
            <h3 className="font-heading text-sm font-bold text-amber-950">
              No device template match
            </h3>
            <p className="mt-2 text-sm text-amber-950/95">
              This device is not covered by a{" "}
              <strong className="font-semibold">Device template</strong> in Settings.
              Assist reported manufacturer{" "}
              <strong>{noTpl.mapped.manufacturer || "—"}</strong> and model{" "}
              <strong>{noTpl.mapped.model || "—"}</strong>. Imports match on
              make + model when both are present, or on model alone when only the
              model number is available (must match exactly one catalog template).
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-xs font-medium text-ink">
                Category if creating a template
              </label>
              <input
                value={tplCategory}
                onChange={(e) => setTplCategory(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                placeholder="Hardware, Laptop, …"
              />
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmNoTemplate("create")}
                className="btn-primary"
              >
                Create template &amp; import
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmNoTemplate("skip")}
                className="font-heading rounded-lg border border-amber-800/40 bg-white px-4 py-2 text-xs font-bold text-amber-950 disabled:opacity-50"
              >
                Import without template
              </button>
              <button
                type="button"
                onClick={() => setNoTpl(null)}
                className="font-heading rounded-lg px-4 py-2 text-xs font-bold text-ink"
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

function ClubAssignedAssetsPanel({
  loading,
  error,
  assets,
  matchingAsset,
}: {
  loading: boolean;
  error: string | null;
  assets: ClubAsset[];
  matchingAsset: ClubAsset | null;
}) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-black/[0.02] p-3">
      <p className="text-xs font-bold text-muted">
        Already assigned to this club
      </p>
      {loading ? (
        <p className="mt-2 text-xs text-muted">Loading club assets…</p>
      ) : error ? (
        <p className="mt-2 text-xs text-red-800">{error}</p>
      ) : assets.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          No assets registered to this club yet.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            {assets.length} asset{assets.length === 1 ? "" : "s"} on record — check
            before importing.
          </p>
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {assets.map((asset) => {
              const isMatch = matchingAsset?.id === asset.id;
              return (
                <li
                  key={asset.id}
                  className={`rounded-md border px-2.5 py-2 ${
                    isMatch
                      ? "border-amber-300 bg-amber-50"
                      : "border-line bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-ink">{asset.assetName}</span>
                    {asset.dataSource === "zoho_assist" ? (
                      <span className="rounded border border-brand/30 bg-brand-muted px-1 py-px text-xs font-bold text-hna-green-text">
                        Assist
                      </span>
                    ) : null}
                    <span className="rounded border border-line bg-black/[0.03] px-1 py-px text-xs font-semibold text-muted">
                      {asset.status.label}
                    </span>
                  </div>
                  {asset.serialNumber ? (
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      S/N {asset.serialNumber}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
