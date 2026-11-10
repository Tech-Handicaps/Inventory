"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ReplacementStockOption,
  ReplacementTemplateOption,
} from "@/lib/finance/replacement-unit";
import { reservationLabel } from "@/lib/finance/reservation-shared";

type ReplacementSource = "stock" | "procure";

type ReplacementOptions = {
  stock: ReplacementStockOption[];
  templates: ReplacementTemplateOption[];
};

function makeModelText(
  manufacturer: string | null | undefined,
  model: string | null | undefined
): string {
  return [manufacturer?.trim(), model?.trim()].filter(Boolean).join(" · ");
}

function stockOptionLabel(o: ReplacementStockOption): string {
  return [
    o.assetName,
    makeModelText(o.manufacturer, o.model),
    o.serialNumber ? `S/N ${o.serialNumber}` : "no serial",
    o.statusLabel,
  ]
    .filter(Boolean)
    .join(" — ");
}

type Asset = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  status: { code: string };
};

type Props = {
  asset: Asset | null;
  assessmentId?: string | null;
  assessmentReference?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function WriteOffModal({
  asset,
  assessmentId,
  assessmentReference,
  onClose,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [xeroFixedAssetNumber, setXeroFixedAssetNumber] = useState("");
  const [replacementRequested, setReplacementRequested] = useState(false);
  const [replacementSource, setReplacementSource] =
    useState<ReplacementSource>("stock");
  const [replacementStockAssetId, setReplacementStockAssetId] = useState("");
  const [replacementDeviceTemplateId, setReplacementDeviceTemplateId] =
    useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [options, setOptions] = useState<ReplacementOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [replacementXeroFixedAssetNumber, setReplacementXeroFixedAssetNumber] =
    useState("");
  const [replacementNotes, setReplacementNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setReason("");
      setSerialNumber(asset.serialNumber ?? "");
      setXeroFixedAssetNumber("");
      setReplacementRequested(false);
      setReplacementSource("stock");
      setReplacementStockAssetId("");
      setReplacementDeviceTemplateId("");
      setStockSearch("");
      setOptions(null);
      setOptionsError(null);
      setReplacementXeroFixedAssetNumber("");
      setReplacementNotes("");
      setError(null);
    }
  }, [asset]);

  const assetId = asset?.id;
  useEffect(() => {
    if (!replacementRequested || !assetId || options) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/replacement-options`);
        const j = (await res.json().catch(() => ({}))) as
          | ReplacementOptions
          | { error?: string };
        if (!res.ok || !("stock" in j)) {
          throw new Error(
            "error" in j && typeof j.error === "string"
              ? j.error
              : "Could not load stock"
          );
        }
        if (cancelled) return;
        setOptions(j);
        const firstFree = j.stock.find((o) => !o.reservedBy);
        if (firstFree) {
          setReplacementSource("stock");
        } else {
          setReplacementSource("procure");
          const sameTemplate = j.templates.find((t) => t.sameModel);
          if (sameTemplate) setReplacementDeviceTemplateId(sameTemplate.id);
        }
      } catch (err) {
        if (!cancelled) {
          setOptionsError(
            err instanceof Error ? err.message : "Could not load stock"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [replacementRequested, assetId, options]);

  const filteredStock = useMemo(() => {
    const all = options?.stock ?? [];
    const q = stockSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) =>
      [o.assetName, o.manufacturer, o.model, o.serialNumber, o.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [options, stockSearch]);

  const selectedStock =
    options?.stock.find((o) => o.id === replacementStockAssetId) ?? null;
  const selectedTemplate =
    options?.templates.find((t) => t.id === replacementDeviceTemplateId) ??
    null;
  const freeStockCount =
    options?.stock.filter((o) => !o.reservedBy).length ?? 0;

  if (!asset) return null;

  const fromAssessment = asset.status.code === "assessment";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;

    const reasonTrimmed = reason.trim();
    if (!reasonTrimmed) {
      setError("Enter why this unit cannot be repaired or returned to service.");
      return;
    }

    if (replacementRequested) {
      if (replacementSource === "stock" && !selectedStock) {
        setError("Pick the replacement unit from New Stock / Refurbished.");
        return;
      }
      if (replacementSource === "procure" && !selectedTemplate) {
        setError("Pick the model to procure.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}/write-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reasonTrimmed,
          serialNumber: serialNumber.trim() || null,
          xeroFixedAssetNumber: xeroFixedAssetNumber.trim() || undefined,
          replacementRequested,
          replacementSource: replacementRequested
            ? replacementSource
            : undefined,
          replacementStockAssetId:
            replacementRequested && replacementSource === "stock"
              ? replacementStockAssetId
              : undefined,
          replacementDeviceTemplateId:
            replacementRequested && replacementSource === "procure"
              ? replacementDeviceTemplateId
              : undefined,
          replacementXeroFixedAssetNumber: replacementRequested
            ? replacementXeroFixedAssetNumber.trim() || undefined
            : undefined,
          replacementNotes: replacementRequested
            ? replacementNotes.trim() || undefined
            : undefined,
          assessmentId: fromAssessment
            ? assessmentId?.trim() || undefined
            : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : "Could not complete write-off"
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Write-off failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="write-off-title"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="modal-panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="write-off-title"
          className="font-heading text-lg font-bold text-ink"
        >
          Write off (cannot repair)
        </h2>
        <p className="mt-1 text-sm text-muted">
          {asset.assetName}
          {asset.serialNumber ? (
            <span className="ml-2 font-mono text-xs">
              S/N {asset.serialNumber}
            </span>
          ) : null}
        </p>
        {assessmentReference?.trim() ? (
          <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Completing intake{" "}
            <span className="font-mono font-semibold">
              {assessmentReference.trim()}
            </span>
            {" — "}
            this write-off report closes the Assessment/Maintenance intake and
            notifies finance.
          </p>
        ) : asset.status.code === "repair" ? (
          <p className="mt-2 rounded-lg border border-orange-200/80 bg-orange-50 px-3 py-2 text-xs text-orange-950">
            Recording write-off from <strong>In Repairs</strong>. Finance will be
            notified with the details below.
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink">
              Serial number
            </span>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-sm"
              placeholder="Confirm or enter serial"
            />
            <p className="mt-1 text-xs text-muted">
              Confirm the unit being written off. Correct only if the registry
              serial was wrong.
            </p>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink">
              Xero fixed asset number
            </span>
            <input
              type="text"
              value={xeroFixedAssetNumber}
              onChange={(e) => setXeroFixedAssetNumber(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-mono text-sm"
              placeholder="From finance (written-off unit)"
            />
            <p className="mt-1 text-xs text-muted">
              Enter the Xero fixed asset number for this unit when finance
              provides it.
            </p>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink">
              Write-off reason <span className="text-red-600">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              placeholder="e.g. Motherboard failure — uneconomical to repair; physical damage beyond depot scope"
            />
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={replacementRequested}
              onChange={(e) => setReplacementRequested(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-ink">
              Request a <strong>replacement</strong> unit for this site / club
            </span>
          </label>

          {replacementRequested ? (
            <div className="space-y-3 rounded-lg border border-line bg-black/[0.02] p-3">
              <p className="text-xs font-semibold text-muted">
                Replacement unit
              </p>
              {optionsError ? (
                <p className="text-sm text-red-700" role="alert">
                  {optionsError}
                </p>
              ) : !options ? (
                <p className="text-xs text-muted">Loading stock…</p>
              ) : (
                <>
                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-medium text-ink">
                      Where does the replacement come from?{" "}
                      <span className="text-red-600">*</span>
                    </legend>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name="replacement-source"
                        checked={replacementSource === "stock"}
                        onChange={() => setReplacementSource("stock")}
                        disabled={freeStockCount === 0}
                      />
                      From stock (New Stock / Refurbished) —{" "}
                      {freeStockCount} available
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name="replacement-source"
                        checked={replacementSource === "procure"}
                        onChange={() => setReplacementSource("procure")}
                      />
                      Not in stock — to be procured
                    </label>
                  </fieldset>

                  {replacementSource === "stock" ? (
                    <label className="block">
                      <span className="text-xs font-medium text-ink">
                        Replacement unit <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="search"
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                        placeholder="Search name, model or serial"
                        aria-label="Search stock"
                      />
                      <select
                        value={replacementStockAssetId}
                        onChange={(e) =>
                          setReplacementStockAssetId(e.target.value)
                        }
                        className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Choose a unit…</option>
                        {(
                          [
                            ["Same model", (o: ReplacementStockOption) => !o.reservedBy && o.sameModel],
                            ["Other stock", (o: ReplacementStockOption) => !o.reservedBy && !o.sameModel],
                            ["Already reserved for a club", (o: ReplacementStockOption) => Boolean(o.reservedBy)],
                          ] as const
                        ).map(([groupLabel, test]) => {
                          const rows = filteredStock.filter(test);
                          if (rows.length === 0) return null;
                          return (
                            <optgroup key={groupLabel} label={groupLabel}>
                              {rows.map((o) => (
                                <option
                                  key={o.id}
                                  value={o.id}
                                  disabled={Boolean(o.reservedBy)}
                                >
                                  {stockOptionLabel(o)}
                                  {o.reservedBy
                                    ? ` (reserved → ${reservationLabel(o.reservedBy)})`
                                    : ""}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      {filteredStock.length === 0 ? (
                        <p className="mt-1 text-xs text-muted">
                          No stock matches “{stockSearch}”.
                        </p>
                      ) : null}
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-xs font-medium text-ink">
                        Model to procure <span className="text-red-600">*</span>
                      </span>
                      <select
                        value={replacementDeviceTemplateId}
                        onChange={(e) =>
                          setReplacementDeviceTemplateId(e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Choose a model…</option>
                        {options.templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label} — {t.category}
                            {t.sameModel ? " (same as written-off unit)" : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-muted">
                        Models come from Settings → Devices. Add the model there
                        first if it is missing.
                      </p>
                    </label>
                  )}

                  {(replacementSource === "stock"
                    ? selectedStock
                    : selectedTemplate) ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-line bg-white px-3 py-2 text-xs">
                      <dt className="text-muted">Asset name</dt>
                      <dd className="text-ink">
                        {replacementSource === "stock"
                          ? selectedStock?.assetName
                          : selectedTemplate?.label}
                      </dd>
                      <dt className="text-muted">Asset type</dt>
                      <dd className="text-ink">
                        {replacementSource === "stock"
                          ? selectedStock?.category
                          : selectedTemplate?.category}
                      </dd>
                      <dt className="text-muted">Make / model</dt>
                      <dd className="text-ink">
                        {replacementSource === "stock"
                          ? makeModelText(
                              selectedStock?.manufacturer,
                              selectedStock?.model
                            ) || "—"
                          : makeModelText(
                              selectedTemplate?.manufacturer,
                              selectedTemplate?.model
                            )}
                      </dd>
                      <dt className="text-muted">Serial number</dt>
                      <dd className="font-mono text-ink">
                        {replacementSource === "stock"
                          ? selectedStock?.serialNumber || "— (none on register)"
                          : "To be procured"}
                      </dd>
                    </dl>
                  ) : null}
                </>
              )}
              <label className="block">
                <span className="text-xs font-medium text-ink">
                  Xero fixed asset number
                </span>
                <input
                  type="text"
                  value={replacementXeroFixedAssetNumber}
                  onChange={(e) =>
                    setReplacementXeroFixedAssetNumber(e.target.value)
                  }
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm"
                  placeholder="From finance (replacement unit)"
                />
                <p className="mt-1 text-xs text-muted">
                  Enter when finance provides the replacement unit’s Xero fixed
                  asset number.
                </p>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink">
                  Replacement notes (optional)
                </span>
                <textarea
                  value={replacementNotes}
                  onChange={(e) => setReplacementNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                  placeholder="Urgency, same model vs upgrade, club context…"
                />
              </label>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="font-heading rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Confirm write-off"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink hover:bg-black/[0.04]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
