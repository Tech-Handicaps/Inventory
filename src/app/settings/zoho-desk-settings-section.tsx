"use client";

import { useCallback, useEffect, useState } from "react";
import { ZOHO_DATA_CENTERS } from "@/lib/zoho/constants";

type DeskGetResponse = {
  clientId: string | null;
  orgId: string | null;
  departmentId: string | null;
  clientSecretMasked: string | null;
  hasClientSecret: boolean;
  refreshTokenMasked: string | null;
  hasRefreshToken: boolean;
  dataCenter: string;
  readyForOAuth: boolean;
  canTestApi: boolean;
  canCreateTickets: boolean;
  configured: boolean;
};

export function ZohoDeskSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [dataCenter, setDataCenter] = useState("us");
  const [clearClientSecret, setClearClientSecret] = useState(false);
  const [clearRefreshToken, setClearRefreshToken] = useState(false);
  const [meta, setMeta] = useState<Pick<
    DeskGetResponse,
    | "clientSecretMasked"
    | "hasClientSecret"
    | "refreshTokenMasked"
    | "hasRefreshToken"
    | "readyForOAuth"
    | "canTestApi"
    | "canCreateTickets"
    | "configured"
  > | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/zoho-desk");
    if (!res.ok) throw new Error("Failed to load Zoho Desk settings");
    const data = (await res.json()) as DeskGetResponse;
    setOrgId(data.orgId ?? "");
    setDepartmentId(data.departmentId ?? "");
    setClientId(data.clientId ?? "");
    setDataCenter(data.dataCenter || "us");
    setMeta({
      clientSecretMasked: data.clientSecretMasked,
      hasClientSecret: data.hasClientSecret,
      refreshTokenMasked: data.refreshTokenMasked,
      hasRefreshToken: data.hasRefreshToken,
      readyForOAuth: data.readyForOAuth,
      canTestApi: data.canTestApi,
      canCreateTickets: data.canCreateTickets,
      configured: data.configured,
    });
    setClearClientSecret(false);
    setClearRefreshToken(false);
    setClientSecret("");
    setRefreshToken("");
  }, []);

  useEffect(() => {
    load()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/zoho-desk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: orgId.trim(),
          departmentId: departmentId.trim() || undefined,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim() || undefined,
          refreshToken: refreshToken.trim() || undefined,
          dataCenter,
          clearClientSecret,
          clearRefreshToken,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/zoho-desk/test", {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Test failed");
      }
      setTestResult(JSON.stringify(j, null, 2));
    } catch (err) {
      setTestResult(
        JSON.stringify(
          { ok: false, error: err instanceof Error ? err.message : "Test failed" },
          null,
          2
        )
      );
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-4">
        <p className="text-sm text-black/55">Loading Zoho Desk settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
        Zoho Desk API
      </h2>
      <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
      <p className="mt-4 text-sm leading-relaxed text-black/70">
        Separate OAuth client from <strong>Zoho Assist</strong>. Register a client in the{" "}
        <a
          href="https://api-console.zoho.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand underline"
        >
          Zoho API Console
        </a>{" "}
        with scopes such as <code className="rounded bg-black/5 px-1 text-xs">Desk.tickets.ALL</code>{" "}
        (or create/update ticket scopes). Paste the{" "}
        <strong>organization id</strong> from Zoho Desk (Setup → Developer Space →
        APIs) and optionally a default <strong>department id</strong> for new tickets.
        If department is empty, the first department returned by the API is used.
      </p>

      <form onSubmit={save} className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-black/70">Data center</label>
          <select
            value={dataCenter}
            onChange={(e) => setDataCenter(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-black/15 px-3 py-2 text-sm"
          >
            {ZOHO_DATA_CENTERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-black/70">
            Desk organization id <span className="text-red-600">*</span>
          </label>
          <input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            autoComplete="off"
            placeholder="Required for API calls (orgId header)"
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-black/70">
            Default department id (optional)
          </label>
          <input
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            autoComplete="off"
            placeholder="Leave blank to use first department from Desk"
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-black/70">Client ID</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-black/70">Client secret</label>
          {meta?.hasClientSecret ? (
            <p className="mt-1 text-xs text-black/55">
              Stored: <span className="font-mono">{meta.clientSecretMasked}</span>
            </p>
          ) : null}
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-black/70">
            <input
              type="checkbox"
              checked={clearClientSecret}
              onChange={(e) => setClearClientSecret(e.target.checked)}
            />
            Clear saved client secret on save
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-black/70">Refresh token</label>
          {meta?.hasRefreshToken ? (
            <p className="mt-1 text-xs text-black/55">
              Stored:{" "}
              <span className="font-mono">{meta.refreshTokenMasked}</span>
            </p>
          ) : null}
          <textarea
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            rows={2}
            placeholder="Generate in API Console (Self Client) with Desk scopes"
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-xs"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-black/70">
            <input
              type="checkbox"
              checked={clearRefreshToken}
              onChange={(e) => setClearRefreshToken(e.target.checked)}
            />
            Clear saved refresh token on save
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="font-heading rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Desk credentials"}
          </button>
          <button
            type="button"
            disabled={testing || !meta?.canTestApi}
            onClick={() => void runTest()}
            className="font-heading rounded-lg border-2 border-brand bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-brand disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test Desk API"}
          </button>
        </div>
        {meta?.canCreateTickets ? (
          <p className="text-xs text-emerald-800">
            Ready to create tickets from the hardware board (Log repair).
          </p>
        ) : (
          <p className="text-xs text-black/55">
            Fill org id, client credentials, and refresh token to enable ticket creation.
          </p>
        )}
      </form>

      {testResult ? (
        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-black/70">
            API test response
          </h3>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-black/10 bg-black/[0.03] p-4 font-mono text-xs text-black/90">
            {testResult}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
