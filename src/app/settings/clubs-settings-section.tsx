"use client";

import { useCallback, useEffect, useState } from "react";

type Club = {
  id: string;
  name: string;
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
    return "Server error (non-JSON response). Check deployment logs.";
  }
}

export function ClubsSettingsSection() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/clubs");
    const data = await res.json();
    setClubs(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
  }

  function startEdit(c: Club) {
    setEditingId(c.id);
    setName(c.name);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/clubs/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) throw new Error(await apiErrorMessage(res));
      } else {
        const res = await fetch("/api/clubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) throw new Error(await apiErrorMessage(res));
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
        "Delete this club? Devices linked to it will have club cleared (not deleted)."
      )
    )
      return;
    const res = await fetch(`/api/clubs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(await apiErrorMessage(res));
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-sm text-black/55">Loading clubs…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
          About clubs
        </h2>
        <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
        <p className="mt-4 text-sm leading-relaxed text-black/70">
          Maintain the official list of <strong>club names</strong> (sites or member clubs).
          On <strong>All assets</strong> and when registering hardware, each device can be
          assigned to one club so the registry stays consistent and easy to filter visually.
        </p>
      </div>

      <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          {editingId ? "Edit club" : "Add club"}
        </h3>
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[240px] flex-1">
            <label className="text-xs font-medium text-black/70">Club name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Atlantic Country Club"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="font-heading rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Update club" : "Add club"}
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
          Catalog ({clubs.length})
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {clubs.map((c) => (
                <tr key={c.id} className="border-b border-black/5">
                  <td className="py-2 pr-4 font-medium">{c.name}</td>
                  <td className="py-2 pr-0 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="mr-2 text-xs font-semibold uppercase text-brand hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="text-xs font-semibold uppercase text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clubs.length === 0 && (
            <p className="py-8 text-center text-sm text-black/45">
              No clubs yet. Add one using the form above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
