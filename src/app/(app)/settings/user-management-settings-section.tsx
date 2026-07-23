"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ASSIGNABLE_ROLES,
  roleDescription,
  roleLabel,
  type AssignableRole,
} from "@/lib/auth/assignable-roles";
import type { AppRole } from "@/lib/auth/roles";

type Row = {
  id: string;
  email: string;
  username: string | null;
  role: AppRole;
  createdAt: string;
  lastSignInAt: string | null;
  readOnly: boolean;
  disabled?: boolean;
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

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [createRole, setCreateRole] = useState<AssignableRole>("operations");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("operations");
  const [showInvite, setShowInvite] = useState(false);

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

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setMessage(null);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: createRole,
        }),
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
          : "User created."
      );
      setUsername("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inviteEmail.trim().toLowerCase();
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
        typeof j.message === "string" ? j.message : "Done."
      );
      setInviteEmail("");
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

  async function setDisabled(userId: string, disabled: boolean) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      setMessage(disabled ? "User disabled." : "User enabled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-black/55">Loading users…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          Create user
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-black/65">
          Create an account with username, email, and password. Users can sign in
          with either username or email. Super admin is controlled via{" "}
          <code className="rounded bg-black/[0.06] px-1 text-xs">
            SUPER_ADMIN_EMAILS
          </code>
          , not here.
        </p>

        <form
          onSubmit={submitCreate}
          className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2"
        >
          <label className="block">
            <span className="text-xs font-medium text-black/70">Username</span>
            <input
              type="text"
              name="username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              placeholder="jsmith"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._-]{3,32}"
            />
          </label>
          <label className="block">
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
          <label className="block">
            <span className="text-xs font-medium text-black/70">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              required
              minLength={8}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-black/70">
              Confirm password
            </span>
            <input
              type="password"
              name="passwordConfirm"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
              required
              minLength={8}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-black/70">Role</span>
            <select
              value={createRole}
              onChange={(e) => setCreateRole(e.target.value as AssignableRole)}
              className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-black/55">
              {roleDescription(createRole)}
            </p>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="font-heading rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Working…" : "Create user"}
            </button>
          </div>
        </form>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="text-sm font-medium text-brand hover:underline"
        >
          {showInvite ? "Hide email invite" : "Invite by email instead"}
        </button>
        {showInvite ? (
          <div className="mt-3">
            <p className="max-w-2xl text-sm text-black/65">
              Sends a Supabase invite email when the address is new. If the user
              already exists, their role is updated instead. They set their own
              password via the invite link.
            </p>
            <form
              onSubmit={submitInvite}
              className="mt-3 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
            >
              <label className="block min-w-0 flex-1">
                <span className="text-xs font-medium text-black/70">Email</span>
                <input
                  type="email"
                  name="inviteEmail"
                  autoComplete="off"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
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
                className="font-heading rounded-lg border border-brand/40 bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-brand-hover transition-colors hover:bg-brand-muted disabled:opacity-50"
              >
                {saving ? "Working…" : "Invite / update"}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => reload()}
            disabled={saving || loading}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
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
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.03] text-left">
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Last sign-in</th>
                <th className="px-4 py-3 font-medium">Change role</th>
                <th className="px-4 py-3 font-medium">Access</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-black/5">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {row.username ?? (
                      <span className="text-black/40">—</span>
                    )}
                  </td>
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
                  <td className="px-4 py-2">
                    {row.readOnly ? (
                      <span className="text-xs text-black/45">Protected</span>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void setDisabled(row.id, !(row.disabled ?? false))
                        }
                        className={`rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          row.disabled
                            ? "border border-black/15 bg-white text-black/70 hover:bg-black/[0.04]"
                            : "bg-black text-white hover:bg-black/85"
                        }`}
                      >
                        {row.disabled ? "Enable" : "Disable"}
                      </button>
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
