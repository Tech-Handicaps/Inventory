"use client";

import { useCallback, useEffect, useState } from "react";
import { ZOHO_DATA_CENTERS } from "@/lib/zoho/constants";

type ZohoGetResponse = {
  clientId: string | null;
  clientSecretMasked: string | null;
  hasClientSecret: boolean;
  refreshTokenMasked: string | null;
  hasRefreshToken: boolean;
  dataCenter: string;
  defaultOrgId: string | null;
  defaultDepartmentId: string | null;
  readyForOAuth: boolean;
  canTestApi: boolean;
};

export function ZohoAssistSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [dataCenter, setDataCenter] = useState("us");
  const [clearClientSecret, setClearClientSecret] = useState(false);
  const [clearRefreshToken, setClearRefreshToken] = useState(false);
  const [defaultOrgId, setDefaultOrgId] = useState("");
  const [defaultDepartmentId, setDefaultDepartmentId] = useState("");

  const [meta, setMeta] = useState<Pick<
    ZohoGetResponse,
    | "clientSecretMasked"
    | "hasClientSecret"
    | "refreshTokenMasked"
    | "hasRefreshToken"
    | "readyForOAuth"
    | "canTestApi"
  > | null>(null);

  const [testResult, setTestResult] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [lastApiVerified, setLastApiVerified] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/zoho");
    if (!res.ok) {
      throw new Error("Failed to load Zoho settings");
    }
    const data = (await res.json()) as ZohoGetResponse;
    setClientId(data.clientId ?? "");
    setDataCenter(data.dataCenter || "us");
    setDefaultOrgId(data.defaultOrgId ?? "");
    setDefaultDepartmentId(data.defaultDepartmentId ?? "");
    setMeta({
      clientSecretMasked: data.clientSecretMasked,
      hasClientSecret: data.hasClientSecret,
      refreshTokenMasked: data.refreshTokenMasked,
      hasRefreshToken: data.hasRefreshToken,
      readyForOAuth: data.readyForOAuth,
      canTestApi: data.canTestApi,
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = window.localStorage.getItem("zoho_assist_last_api_ok");
      if (v) setLastApiVerified(v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 10000);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const zoho = p.get("zoho");
    const err = p.get("zoho_error");
    if (zoho === "connected") {
      setBanner({
        type: "ok",
        text: "Zoho account connected — refresh token saved. You can run an API test below.",
      });
      window.history.replaceState({}, "", "/settings?tab=zoho");
    } else if (err) {
      setBanner({
        type: "err",
        text: `Zoho OAuth: ${decodeURIComponent(err)}`,
      });
      window.history.replaceState({}, "", "/settings?tab=zoho");
    }
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    setSaveNotice(null);
    try {
      const res = await fetch("/api/settings/zoho", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim() || undefined,
          refreshToken: refreshToken.trim() || undefined,
          dataCenter,
          clearClientSecret,
          clearRefreshToken,
          defaultOrgId: defaultOrgId.trim() || null,
          defaultDepartmentId: defaultDepartmentId.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      }
      if (typeof j.clientId === "string") setClientId(j.clientId);
      if (typeof j.dataCenter === "string") setDataCenter(j.dataCenter);
      if ("defaultOrgId" in j && (j.defaultOrgId === null || typeof j.defaultOrgId === "string")) {
        setDefaultOrgId(j.defaultOrgId ?? "");
      }
      if (
        "defaultDepartmentId" in j &&
        (j.defaultDepartmentId === null || typeof j.defaultDepartmentId === "string")
      ) {
        setDefaultDepartmentId(j.defaultDepartmentId ?? "");
      }
      setMeta({
        clientSecretMasked: j.clientSecretMasked,
        hasClientSecret: j.hasClientSecret,
        refreshTokenMasked: j.refreshTokenMasked,
        hasRefreshToken: j.hasRefreshToken,
        readyForOAuth: j.readyForOAuth,
        canTestApi: j.canTestApi,
      });
      setClientSecret("");
      setRefreshToken("");
      setClearClientSecret(false);
      setClearRefreshToken(false);
      const t = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      setSaveNotice(`Credentials saved (${t}).`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function connectZoho() {
    setConnecting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/zoho/oauth-url");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "OAuth URL failed");
      }
      const url = typeof j.url === "string" ? j.url : "";
      if (!url) throw new Error("No OAuth URL returned");
      window.location.assign(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not start OAuth");
    } finally {
      setConnecting(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/zoho/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Test failed");
      }
      setTestResult(JSON.stringify(j, null, 2));
      if (j && typeof j === "object" && (j as { ok?: boolean }).ok === true) {
        const stamp = new Date().toISOString();
        setLastApiVerified(stamp);
        try {
          window.localStorage.setItem("zoho_assist_last_api_ok", stamp);
        } catch {
          /* ignore */
        }
      }
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
        <p className="text-sm text-black/55">Loading Zoho Assist settings…</p>
      </div>
    );
  }

  const hasClientIdSaved = Boolean(clientId?.trim());
  const secretOnServer = meta?.hasClientSecret === true && !clearClientSecret;
  const refreshOnServer = meta?.hasRefreshToken === true && !clearRefreshToken;
  const pendingSecretInForm = Boolean(clientSecret.trim());
  const pendingRefreshInForm = Boolean(refreshToken.trim());
  const oauthAppReady =
    hasClientIdSaved && (secretOnServer || pendingSecretInForm);
  const canCallAssistApi =
    oauthAppReady && (refreshOnServer || pendingRefreshInForm);

  let statusHeadline = "Setup required";
  let statusBody =
    "Save your Zoho API Console Client ID and Client Secret first.";
  let statusClass =
    "border-neutral-200 bg-neutral-50 text-neutral-900";

  if (oauthAppReady && !canCallAssistApi) {
    statusHeadline = "Credentials saved — token needed";
    statusBody =
      "OAuth app credentials are stored. Connect Zoho or paste a refresh token, then save, to call the Assist API.";
    statusClass = "border-amber-200 bg-amber-50 text-amber-950";
  } else if (canCallAssistApi) {
    statusHeadline = "Assist API ready";
    statusBody =
      "Saved credentials can obtain an access token. Use Test API to confirm Zoho returns your user profile.";
    statusClass = "border-emerald-200 bg-emerald-50 text-emerald-950";
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
        Zoho Assist API
      </h2>
      <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />

      <div
        className={`rounded-xl border-2 px-4 py-4 sm:px-5 ${statusClass}`}
        role="status"
        aria-live="polite"
      >
        <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
          Connection status
        </p>
        <p className="mt-2 text-base font-bold">{statusHeadline}</p>
        <p className="mt-1 text-sm leading-relaxed opacity-90">{statusBody}</p>
        <ul className="mt-4 space-y-2 border-t border-black/10 pt-3 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 font-mono text-base" aria-hidden>
              {hasClientIdSaved ? "✓" : "○"}
            </span>
            <span>
              <span className="font-medium">Client ID</span>{" "}
              {hasClientIdSaved ? (
                <span className="text-black/70">saved in app settings</span>
              ) : (
                <span className="text-black/70">not saved yet</span>
              )}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 font-mono text-base" aria-hidden>
              {secretOnServer || pendingSecretInForm ? "✓" : "○"}
            </span>
            <span>
              <span className="font-medium">Client secret</span>{" "}
              {secretOnServer ? (
                <span className="text-black/70">stored (masked below)</span>
              ) : pendingSecretInForm ? (
                <span className="text-amber-900/90">
                  entered in form — click Save to store
                </span>
              ) : (
                <span className="text-black/70">not saved yet</span>
              )}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 font-mono text-base" aria-hidden>
              {refreshOnServer || pendingRefreshInForm ? "✓" : "○"}
            </span>
            <span>
              <span className="font-medium">Refresh token</span>{" "}
              {refreshOnServer ? (
                <span className="text-black/70">stored — API calls enabled</span>
              ) : pendingRefreshInForm ? (
                <span className="text-amber-900/90">
                  entered in form — click Save to store
                </span>
              ) : (
                <span className="text-black/70">
                  not saved — use Connect or paste token
                </span>
              )}
            </span>
          </li>
        </ul>
        {lastApiVerified ? (
          <p className="mt-3 border-t border-black/10 pt-3 text-xs text-black/65">
            Last successful <strong>Test API</strong>:{" "}
            {new Date(lastApiVerified).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        ) : (
          <p className="mt-3 border-t border-black/10 pt-3 text-xs text-black/55">
            Run <strong>Test API</strong> after saving to confirm Assist responds.
          </p>
        )}
      </div>

      {saveNotice ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          {saveNotice}
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-black/70">
        Register a client in the{" "}
        <a
          href="https://api-console.zoho.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand underline"
        >
          Zoho API Console
        </a>{" "}
        (Server-based / Web client). Set the redirect URI to{" "}
        <code className="rounded bg-black/5 px-1 text-xs">
          {appOrigin || "https://your-app.example"}
          /api/settings/zoho/callback
        </code>
        . Choose the data center that matches your Zoho account. Save credentials,
        then use <strong>Connect Zoho Account</strong> or paste a refresh token from
        the console (Self Client), and run <strong>Test API</strong> to verify{" "}
        <code className="rounded bg-black/5 px-1 text-xs">GET /api/v2/user</code>.
        For unattended device APIs, set default <strong>org</strong> and{" "}
        <strong>department</strong> IDs (from Assist /{" "}
        <code className="rounded bg-black/5 px-1 text-xs">GET /api/v2/user</code>{" "}
        → departments) or pass them per request when fetching device details.
      </p>

      {banner ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-black/70">
              Default org id (Assist)
            </label>
            <input
              value={defaultOrgId}
              onChange={(e) => setDefaultOrgId(e.target.value)}
              autoComplete="off"
              placeholder="x-com-zoho-assist-orgid — optional"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/70">
              Default department id (Assist)
            </label>
            <input
              value={defaultDepartmentId}
              onChange={(e) => setDefaultDepartmentId(e.target.value)}
              autoComplete="off"
              placeholder="Required for GET /api/v2/devices/…"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-black/70">Client ID</label>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            autoComplete="off"
            placeholder="From Zoho API Console"
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
            placeholder={
              meta?.hasClientSecret
                ? "Leave blank to keep existing, or enter a new secret"
                : "Paste client secret"
            }
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
          <label className="text-xs font-medium text-black/70">
            Refresh token (optional)
          </label>
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
            placeholder="Paste refresh token from Zoho API Console (Self Client), or use Connect below"
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
            {saving ? "Saving…" : "Save Zoho credentials"}
          </button>
          <button
            type="button"
            disabled={connecting || !meta?.readyForOAuth}
            onClick={() => void connectZoho()}
            className="font-heading rounded-lg border-2 border-black bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-black disabled:opacity-50"
          >
            {connecting ? "Redirecting…" : "Connect Zoho Account"}
          </button>
          <button
            type="button"
            disabled={testing || !meta?.canTestApi}
            onClick={() => void runTest()}
            className="font-heading rounded-lg border-2 border-brand bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-brand disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test API"}
          </button>
        </div>
        {!meta?.readyForOAuth ? (
          <p className="text-xs text-amber-800">
            Save Client ID and Client Secret before connecting or testing.
          </p>
        ) : !meta?.canTestApi ? (
          <p className="text-xs text-black/55">
            Connect Zoho Account or save a refresh token to enable API test.
          </p>
        ) : null}
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
