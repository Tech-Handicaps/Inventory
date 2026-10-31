"use client";

import { SectionSkeleton } from "@/components/Skeleton";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ToastProvider";
import { apiErrorMessage } from "@/lib/client/api-error";
import { assetTagsForDisplay } from "@/lib/inventory/asset-tags";
import { displayDeviceTemplateLabel } from "@/lib/inventory/device-template-label";
import { useAssetTagSuggestions } from "@/lib/inventory/use-asset-tag-suggestions";
import { TemplateDuplicatesPanel } from "./template-duplicates-panel";

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
  const [pendingDelete, setPendingDelete] = useState<DeviceTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reviewVersion, setReviewVersion] = useState(0);

  const [labelPreview, setLabelPreview] = useState("");

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
    setLabelPreview("");
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
    setLabelPreview(displayDeviceTemplateLabel(t));
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
    if (!manufacturer.trim() || !model.trim() || tags.length === 0) return;
    setSaving(true);
    try {
      const body = {
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        tags,
        notes: notes.trim() || null,
        processorName: processorName.trim() || null,
        systemRam: systemRam.trim() || null,
        systemGpu: systemGpu.trim() || null,
      };
      if (editingId) {
        const res = await fetch(`/api/device-templates/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(await apiErrorMessage(res));
        }
      } else {
        const res = await fetch("/api/device-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
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
      setReviewVersion((v) => v + 1);
    } catch (err) {
      console.error(err);
      toast.showError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    try {
      const res = await fetch(`/api/device-templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.showError(await apiErrorMessage(res));
        return;
      }
      setPendingDelete(null);
      if (editingId === id) resetForm();
      await load();
      setReviewVersion((v) => v + 1);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-white p-8">
        <SectionSkeleton label="Loading device templates" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-line bg-white p-6">
        <h2 className="font-heading text-lg font-bold text-ink">
          About device templates
        </h2>
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
        <p className="mt-4 text-sm leading-relaxed text-ink">
          Define reusable device types (make, model, default category, optional typical
          CPU/RAM/GPU for that SKU). On the <strong>Hardware board</strong>, choose a
          template when adding an asset to pre-fill fields; you can still edit before
          saving. Custom entries without a template still work.
        </p>
      </div>

      <section className="rounded-lg border border-line bg-white p-6">
        <h3 className="font-heading text-sm font-bold text-ink">
          {editingId ? "Edit template" : "Add template"}
        </h3>
        <form
          onSubmit={submit}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-xs font-medium text-ink">Catalog label</p>
            <p className="mt-1 rounded-lg border border-line bg-black/[0.02] px-3 py-2 text-sm text-ink">
              {labelPreview ||
                displayDeviceTemplateLabel({ manufacturer, model, label: "" }) ||
                "Enter manufacturer and model — label is generated automatically."}
            </p>
            <p className="mt-1 text-xs text-muted">
              Built from manufacturer + model (not asset deployment names like HNA-CLUB-01).
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-ink">
              Manufacturer
            </label>
            <input
              required
              value={manufacturer}
              onChange={(e) => {
                setManufacturer(e.target.value);
                setLabelPreview(
                  displayDeviceTemplateLabel({
                    manufacturer: e.target.value,
                    model,
                    label: "",
                  })
                );
              }}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink">Model</label>
            <input
              required
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setLabelPreview(
                  displayDeviceTemplateLabel({
                    manufacturer,
                    model: e.target.value,
                    label: "",
                  })
                );
              }}
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
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
            <label className="text-xs font-medium text-ink">
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specs, procurement notes…"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink">
              Typical processor (optional)
            </label>
            <input
              value={processorName}
              onChange={(e) => setProcessorName(e.target.value)}
              placeholder="Pre-fills new assets"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink">
              Typical RAM (optional)
            </label>
            <input
              value={systemRam}
              onChange={(e) => setSystemRam(e.target.value)}
              placeholder="e.g. 16 GB"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink">
              Typical GPU (optional)
            </label>
            <input
              value={systemGpu}
              onChange={(e) => setSystemGpu(e.target.value)}
              placeholder="Pre-fills new assets"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Saving…" : editingId ? "Update template" : "Add template"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white p-6">
        <h3 className="font-heading text-sm font-bold text-ink">
          Catalog ({templates.length})
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
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
                <tr key={t.id} className="border-b border-line">
                  <td className="py-2 pr-4 font-medium">
                    {displayDeviceTemplateLabel(t)}
                  </td>
                  <td className="py-2 pr-4">{t.manufacturer}</td>
                  <td className="py-2 pr-4">{t.model}</td>
                  <td className="py-2 pr-4">
                    {assetTagsForDisplay(t.tags, t.category).join(" · ")}
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted">
                    {[t.processorName, t.systemRam, t.systemGpu]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="py-2 pr-4 text-muted">{t.notes ?? "—"}</td>
                  <td className="py-2 pr-0 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="text-xs font-semibold text-brand-deep hover:underline"
                      >
                        Edit
                      </button>
                      <OverflowMenu
                        label={displayDeviceTemplateLabel(t)}
                        items={[
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => setPendingDelete(t),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {templates.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              No templates yet. Add one using the form above.
            </p>
          )}
        </div>
      </section>

      <TemplateDuplicatesPanel key={reviewVersion} onChanged={() => void load()} />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete device template?"
        itemName={pendingDelete ? displayDeviceTemplateLabel(pendingDelete) : ""}
        itemDetail={pendingDelete ? `${pendingDelete.manufacturer} ${pendingDelete.model}` : null}
        consequence="Assets that use this template keep their make and model. Only the link to the template is cleared."
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
