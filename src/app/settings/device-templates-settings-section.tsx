"use client";

import { useCallback, useEffect, useState } from "react";

type DeviceTemplate = {
  id: string;
  label: string;
  manufacturer: string;
  model: string;
  category: string;
  notes: string | null;
};

export function DeviceTemplatesSettingsSection() {
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/device-templates");
    const data = await res.json();
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
    setCategory("");
    setNotes("");
  }

  function startEdit(t: DeviceTemplate) {
    setEditingId(t.id);
    setLabel(t.label);
    setManufacturer(t.manufacturer);
    setModel(t.model);
    setCategory(t.category);
    setNotes(t.notes ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !manufacturer.trim() || !model.trim() || !category.trim())
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
            category: category.trim(),
            notes: notes.trim() || null,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Update failed");
        }
      } else {
        const res = await fetch("/api/device-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            manufacturer: manufacturer.trim(),
            model: model.trim(),
            category: category.trim(),
            notes: notes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "Create failed");
        }
      }
      resetForm();
      await load();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Save failed");
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
      alert("Delete failed");
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
        <p className="mt-4 text-sm leading-relaxed text-black/70">
          Define reusable device types (make, model, default category). On the{" "}
          <strong>Hardware board</strong>, choose a template when adding an asset to
          pre-fill fields; you can still edit before saving. Custom entries without a
          template still work.
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
          <div>
            <label className="text-xs font-medium text-black/70">
              Default category
            </label>
            <input
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Laptop, Monitor, …"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
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
                <th className="py-2 pr-4 font-medium">Category</th>
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
                  <td className="py-2 pr-4">{t.category}</td>
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
              No templates yet. Add one above, or run{" "}
              <code className="rounded bg-black/5 px-1">npm run db:seed</code>.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
