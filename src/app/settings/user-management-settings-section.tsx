"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ASSIGNABLE_ROLES,
  roleLabel,
  type AssignableRole,
} from "@/lib/auth/assignable-roles";
import type { AppRole } from "@/lib/auth/roles";

type Row = {
  id: string;
  email: string;
  role: AppRole;
  createdAt: string;
  lastSignInAt: string | null;
  readOnly: boolean;
};

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: string };
    return j.error ?? (text.trim() || "Request failed");
  } catch {
    return text.trim() || "Request failed";
  }
}

export function UserManagementSettingsSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("admin");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await readError(res));
    }
    const j = (await res.json()) as { items?: Row[] };
    setRows(Array.isArray(j.items) ? j.items : []);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role: inviteRole }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : await readError(res)
        );
      }
      setMessage(
        typeof j.message === "string"
          ? j.message
          : "Done."
      );
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateRole(userId: string, role: AssignableRole) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      setMessage("Role updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-black/55">Loading users…</p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          Invite or assign role
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-black/65">
          Sends a Supabase invite email when the address is new. If the user
          already exists, their role is updated instead. Super admin accounts are
          controlled via{" "}
          <code className="rounded bg-black/[0.06] px-1 text-xs">
            SUPER_ADMIN_EMAILS
          </code>{" "}
          in the server environment, not here.
        </p>

        <form
          onSubmit={submitInvite}
          className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="block min-w-0 flex-1">
            <span className="text-xs font-medium text-black/70">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              placeholder="colleague@example.com"
              required
            />
          </label>
          <label className="block w-full sm:w-48">
            <span className="text-xs font-medium text-black/70">Role</span>
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as AssignableRole)
              }
              className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="font-heading rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Working…" : "Invite / update"}
          </button>
        </form>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-brand" role="status">
          {message}
        </p>
      ) : null}

      <div>
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          Users
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.03] text-left">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Last sign-in</th>
                <th className="px-4 py-3 font-medium">Change role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-black/5">
                  <td className="px-4 py-2.5">{row.email}</td>
                  <td className="px-4 py-2.5 text-black/80">
                    {roleLabel(row.role)}
                  </td>
                  <td className="px-4 py-2.5 text-black/55 tabular-nums">
                    {row.lastSignInAt
                      ? new Date(row.lastSignInAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {row.readOnly ? (
                      <span className="text-xs text-black/45">—</span>
                    ) : (
                      <select
                        aria-label={`Role for ${row.email}`}
                        className="w-full max-w-[220px] rounded border border-black/15 bg-white px-2 py-1.5 text-xs"
                        value={
                          ASSIGNABLE_ROLES.includes(row.role as AssignableRole)
                            ? row.role
                            : "admin"
                        }
                        disabled={saving}
                        onChange={(e) => {
                          const next = e.target.value as AssignableRole;
                          if (next === row.role) return;
                          void updateRole(row.id, next);
                        }}
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-black/45">
              No users returned.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
