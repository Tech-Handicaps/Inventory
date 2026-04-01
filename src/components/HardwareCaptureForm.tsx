"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = {
  id: string;
  code: string;
  label: string;
};

type DeviceTemplate = {
  id: string;
  label: string;
  manufacturer: string;
  model: string;
  category: string;
};

type Props = {
  /** Optional: parent may pass statuses; if empty, the form fetches `/api/statuses` itself. */
  statuses: Status[];
  onCreated: () => void;
};

async function apiErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return "Request failed";
  try {
    const j = JSON.parse(trimmed) as { error?: string; detail?: string };
    return (
      (typeof j.detail === "string" && j.detail) ||
      (typeof j.error === "string" && j.error) ||
      "Request failed"
    );
  } catch {
    return "Server error";
  }
}

export function HardwareCaptureForm({ statuses: statusesProp, onCreated }: Props) {
  const [localStatuses, setLocalStatuses] = useState<Status[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(false);

  const statuses =
    statusesProp.length > 0 ? statusesProp : localStatuses;

  useEffect(() => {
    if (statusesProp.length > 0) return;
    let cancelled = false;
    setStatusesLoading(true);
    fetch("/api/statuses")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setLocalStatuses(data);
      })
      .catch(() => {
        if (!cancelled) setLocalStatuses([]);
      })
      .finally(() => {
        if (!cancelled) setStatusesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusesProp.length]);

  const defaultStatus =
    statuses.find((s) => s.code === "new_stock") ?? statuses[0];

  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [statusId, setStatusId] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    const q = templateFilter.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const hay = `${t.label} ${t.manufacturer} ${t.model} ${t.category}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, templateFilter]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId]
  );

  useEffect(() => {
    if (defaultStatus && !statusId) setStatusId(defaultStatus.id);
  }, [defaultStatus, statusId]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    fetch("/api/device-templates")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTemplate = useCallback(
    (id: string) => {
      setTemplateId(id);
      setFormError(null);
      if (!id) return;
      const t = templates.find((x) => x.id === id);
      if (!t) return;
      setAssetName(t.label);
      setCategory(t.category);
      setManufacturer(t.manufacturer);
      setModel(t.model);
    },
    [templates]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const nameOk = assetName.trim() || Boolean(templateId);
    const catOk = category.trim() || Boolean(templateId);
    if (!nameOk || !catOk || !statusId) {
      setFormError(
        "Provide a display name and category, or choose a device template."
      );
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        assetName: assetName.trim(),
        category: category.trim(),
        statusId,
        serialNumber: serialNumber.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
      };
      if (templateId) payload.deviceTemplateId = templateId;

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res));
      }
      setTemplateId("");
      setTemplateFilter("");
      setAssetName("");
      setCategory("");
      setManufacturer("");
      setModel("");
      setSerialNumber("");
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add hardware");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = statuses.length > 0 && Boolean(statusId);
  const noStatusesYet = !statusesLoading && statuses.length === 0;

  return (
    <section
      id="register-hardware"
      className="overflow-hidden rounded-xl border-2 border-brand/40 bg-white shadow-md ring-1 ring-black/5"
    >
      <div className="border-b border-black/10 bg-brand-muted/40 px-6 py-4">
        <p className="font-heading text-[10px] font-bold uppercase tracking-[0.25em] text-brand">
          Capture assets
        </p>
        <h2 className="font-heading mt-1 text-lg font-bold uppercase tracking-wide text-black">
          Register hardware
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-black/70">
          Each row on the board is a <strong>physical unit</strong>. Pick a{" "}
          <strong>device template</strong> for consistent make/model/category, then
          enter the <strong>serial</strong> (or service tag) so the unit is
          identifiable. Manage templates under{" "}
          <strong>Settings → Device templates</strong>.
        </p>
      </div>

      {statusesLoading && statuses.length === 0 ? (
        <div className="border-b border-black/10 bg-white px-6 py-4 text-sm text-black/60">
          Loading lifecycle stages…
        </div>
      ) : null}

      {noStatusesYet ? (
        <div
          className="border-b border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-medium">No lifecycle stages found — add hardware after seeding the database.</p>
          <p className="mt-2 text-amber-900/90">
            From the project folder run{" "}
            <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-xs">
              npm run db:push
            </code>{" "}
            then{" "}
            <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-xs">
              npm run db:seed
            </code>
            . Ensure <code className="font-mono text-xs">DATABASE_URL</code> is
            set (e.g. in <code className="font-mono text-xs">.env</code>).
          </p>
        </div>
      ) : null}

      <form onSubmit={submit} className="px-6 py-6">
        {formError ? (
          <div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: device identity */}
          <div className="space-y-4">
            <fieldset className="space-y-6">
              <legend className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                1 · Device type
              </legend>

              <div>
                <label
                  htmlFor="hw-template-filter"
                  className="text-xs font-medium text-black/70"
                >
                  Find template
                </label>
                <input
                  id="hw-template-filter"
                  type="search"
                  value={templateFilter}
                  onChange={(e) => setTemplateFilter(e.target.value)}
                  placeholder="Filter by name, make, model…"
                  disabled={templatesLoading}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  autoComplete="off"
                />
              </div>

              <div>
                <label
                  htmlFor="hw-template"
                  className="text-xs font-medium text-black/70"
                >
                  Template
                </label>
                <select
                  id="hw-template"
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  disabled={templatesLoading}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                >
                  <option value="">
                    {templatesLoading
                      ? "Loading templates…"
                      : "Custom — enter make / model below"}
                  </option>
                  {filteredTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} · {t.manufacturer} {t.model}
                    </option>
                  ))}
                </select>
                {!templatesLoading && templates.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-800">
                    No templates yet. Add some under Settings, or use Custom
                    and type make/model manually.
                  </p>
                ) : null}
                {!templatesLoading &&
                templates.length > 0 &&
                filteredTemplates.length === 0 ? (
                  <p className="mt-2 text-xs text-black/55">
                    No matches — clear the filter or choose Custom.
                  </p>
                ) : null}
              </div>

              {selectedTemplate ? (
                <div className="rounded-lg border border-brand/30 bg-brand-muted/30 px-4 py-3 text-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand">
                    From template
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-black/80">
                    <dt className="text-black/45">Category</dt>
                    <dd>{selectedTemplate.category}</dd>
                    <dt className="text-black/45">Manufacturer</dt>
                    <dd>{selectedTemplate.manufacturer}</dd>
                    <dt className="text-black/45">Model</dt>
                    <dd>{selectedTemplate.model}</dd>
                  </dl>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="hw-category"
                    className="text-xs font-medium text-black/70"
                  >
                    Category {!templateId ? "(required)" : ""}
                  </label>
                  <input
                    id="hw-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Laptop, Desktop, Monitor"
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="hw-mfg"
                    className="text-xs font-medium text-black/70"
                  >
                    Manufacturer
                  </label>
                  <input
                    id="hw-mfg"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="e.g. Dell"
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="hw-model"
                    className="text-xs font-medium text-black/70"
                  >
                    Model
                  </label>
                  <input
                    id="hw-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Latitude 5540"
                    className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </fieldset>
          </div>

          {/* Right: this unit */}
          <div className="space-y-4">
            <fieldset className="space-y-6">
              <legend className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-black/50">
                2 · This unit
              </legend>

              <div>
                <label
                  htmlFor="hw-serial"
                  className="text-xs font-medium text-black/70"
                >
                  Serial / service tag
                </label>
                <input
                  id="hw-serial"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Unique per device; leave blank only if unknown"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2.5 font-mono text-sm tracking-wide"
                />
                <p className="mt-1.5 text-xs text-black/45">
                  Used to avoid duplicates and track warranty. Must be unique if
                  provided.
                </p>
              </div>

              <div>
                <label
                  htmlFor="hw-name"
                  className="text-xs font-medium text-black/70"
                >
                  Display name
                </label>
                <input
                  id="hw-name"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  placeholder="Short label on the card (e.g. from template)"
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="hw-stage"
                  className="text-xs font-medium text-black/70"
                >
                  Initial stage
                </label>
                <select
                  id="hw-stage"
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  disabled={statuses.length === 0}
                  className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statuses.length === 0 ? (
                    <option value="">— No stages —</option>
                  ) : null}
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-black/10 pt-6">
          <button
            type="submit"
            disabled={busy || !canSubmit}
            className="font-heading rounded-lg bg-brand px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add to board"}
          </button>
          <p className="text-xs text-black/45">
            You can move cards between columns after they appear.
          </p>
        </div>
      </form>
    </section>
  );
}
