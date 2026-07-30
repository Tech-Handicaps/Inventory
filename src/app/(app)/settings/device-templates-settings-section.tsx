"use client";

import { useCallback, useEffect, useState } from "react";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ToastProvider";
import { apiErrorMessage } from "@/lib/client/api-error";
import { assetTagsForDisplay } from "@/lib/inventory/asset-tags";
import { useAssetTagSuggestions } from "@/lib/inventory/use-asset-tag-suggestions";

type DeviceTemplate = {
  id: string;
  label: string;
  manufacturer: string;
  model: string;
  category: string;
  tags?: string[];
  notes: string | null;
  processorName: string | null;
  systemRam: string | null;
  systemGpu: string | null;
};

export function DeviceTemplatesSettingsSection() {
  const toast = useToast();
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const { suggestions: tagSuggestions } = useAssetTagSuggestions();
  const [notes, setNotes] = useState("");
  const [processorName, setProcessorName] = useState("");
  const [systemRam, setSystemRam] = useState("");
  const [systemGpu, setSystemGpu] = useState("");

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/device-templates");
    const data = await res.json();
    if (!res.ok) {
      setTemplates([]);
      setLoadError(
        typeof data?.error === "string"
          ? data.error
          : `Could not load device templates (${res.status}).`
      );
      return;
    }
    setTemplates(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setManufacturer("");
    setModel("");
    setTags([]);
    setNotes("");
    setProcessorName("");
    setSystemRam("");
    setSystemGpu("");
  }

  function startEdit(t: DeviceTemplate) {
    setEditingId(t.id);
    setLabel(t.label);
    setManufacturer(t.manufacturer);
    setModel(t.model);
    setTags(assetTagsForDisplay(t.tags, t.category));
    setNotes(t.notes ?? "");
    setProcessorName(t.processorName ?? "");
    setSystemRam(t.systemRam ?? "");
    setSystemGpu(t.systemGpu ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !manufacturer.trim() || !model.trim() || tags.length === 0)
      return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/device-templates/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            manufacturer: manufacturer.trim(),
            model: model.trim(),
            tags,
            notes: notes.trim() || null,
            processorName: processorName.trim() || null,
            systemRam: systemRam.trim() || null,
            systemGpu: systemGpu.trim() || null,
          }),
        });
        if (!res.ok) {
          throw new Error(await apiErrorMessage(res));
        }
      } else {
        const res = await fetch("/api/device-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            manufacturer: manufacturer.trim(),
            model: model.trim(),
            tags,
            notes: notes.trim() || undefined,
            processorName: processorName.trim() || undefined,
            systemRam: systemRam.trim() || undefined,
            systemGpu: systemGpu.trim() || undefined,
          }),
        });
        if (!res.ok) {
          throw new Error(await apiErrorMessage(res));
        }
      }
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      toast.showError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (
      !confirm(
        "Delete this template? Existing assets keep their make/model; only the link is cleared."
      )
    )
      return;
    const res = await fetch(`/api/device-templates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.showError(await apiErrorMessage(res));
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-sm text-black/55">Loading device templates…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
          About device templates
        </h2>
        <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
        {loadError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {loadError}
            {loadError.includes("db push") || loadError.includes("SCHEMA") ? (
              <span className="mt-2 block text-red-950/90">
                From the project folder run{" "}
                <code className="rounded bg-red-100/80 px-1 font-mono text-xs">npm run db:push:schema</code>{" "}
                (uses session pooler — see .env.example), then refresh this page.
              </span>
            ) : null}
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-relaxed text-black/70">
          Define reusable device types (make, model, default category, optional typical
          CPU/RAM/GPU for that SKU). On the <strong>Hardware board</strong>, choose a
          template when adding an asset to pre-fill fields; you can still edit before
          saving. Custom entries without a template still work.
        </p>
      </div>

      <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          {editingId ? "Edit template" : "Add template"}
        </h3>
        <form
          onSubmit={submit}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-black/70">
              Display label
            </label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Dell Latitude 5540"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/70">
              Manufacturer
            </label>
            <input
              required
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/70">Model</label>
            <input
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <TagInput
              label="Default asset tags"
              value={tags}
              onChange={setTags}
              suggestions={tagSuggestions}
              required
              placeholder="Hardware, POS Terminal, USB HID Magnetic Stripe Reader…"
              hint="Applied when this template is chosen on the hardware board. First tag is the primary category."
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-medium text-black/70">
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specs, procurement notes…"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/70">
              Typical processor (optional)
            </label>
            <input
              value={processorName}
              onChange={(e) => setProcessorName(e.target.value)}
              placeholder="Pre-fills new assets"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/70">
              Typical RAM (optional)
            </label>
            <input
              value={systemRam}
              onChange={(e) => setSystemRam(e.target.value)}
              placeholder="e.g. 16 GB"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/70">
              Typical GPU (optional)
            </label>
            <input
              value={systemGpu}
              onChange={(e) => setSystemGpu(e.target.value)}
              placeholder="Pre-fills new assets"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="font-heading rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Update template" : "Add template"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="font-heading rounded-lg border-2 border-black bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-black"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          Catalog ({templates.length})
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10">
                <th className="py-2 pr-4 font-medium">Label</th>
                <th className="py-2 pr-4 font-medium">Manufacturer</th>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">Tags</th>
                <th className="py-2 pr-4 font-medium">CPU / RAM / GPU</th>
                <th className="py-2 pr-4 font-medium">Notes</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-black/5">
                  <td className="py-2 pr-4 font-medium">{t.label}</td>
                  <td className="py-2 pr-4">{t.manufacturer}</td>
                  <td className="py-2 pr-4">{t.model}</td>
                  <td className="py-2 pr-4">
                    {assetTagsForDisplay(t.tags, t.category).join(" · ")}
                  </td>
                  <td className="py-2 pr-4 text-xs text-black/65">
                    {[t.processorName, t.systemRam, t.systemGpu]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="py-2 pr-4 text-black/60">{t.notes ?? "—"}</td>
                  <td className="py-2 pr-0 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="mr-2 text-xs font-semibold uppercase text-brand hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      className="text-xs font-semibold uppercase text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && (
            <p className="py-8 text-center text-sm text-black/45">
              No templates yet. Add one using the form above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
