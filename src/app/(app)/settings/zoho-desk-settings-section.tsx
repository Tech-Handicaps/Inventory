"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
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

type DeskHeaderStatus = "connecting" | "live" | "offline";

function deskHeaderStatus(
  oauthConnecting: boolean,
  meta: DeskGetResponse | Pick<
    DeskGetResponse,
    "readyForOAuth" | "hasRefreshToken" | "canCreateTickets"
  > | null
): DeskHeaderStatus {
  if (oauthConnecting) return "connecting";
  if (meta?.canCreateTickets) return "live";
  return "offline";
}

function DeskStatusPill({
  status,
  hint,
}: {
  status: DeskHeaderStatus;
  hint: string | null;
}) {
  const cfg = {
    offline: {
      label: "Offline",
      border: "border-slate-300 bg-slate-50 text-slate-800",
      dot: "bg-slate-400",
    },
    connecting: {
      label: "Connecting…",
      border: "border-amber-300 bg-amber-50 text-amber-950",
      dot: "animate-pulse bg-amber-500",
    },
    live: {
      label: "Live",
      border: "border-emerald-300 bg-emerald-50 text-emerald-950",
      dot: "bg-emerald-500",
    },
  } as const;

  const c = cfg[status];
  return (
    <div
      className="flex flex-col items-end gap-1 text-right"
      role="status"
      aria-live="polite"
    >
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-widest ${c.border}`}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`}
          aria-hidden
        />
        {c.label}
      </div>
      {hint ? (
        <p className="max-w-[240px] text-[11px] leading-snug text-black/55">{hint}</p>
      ) : null}
    </div>
  );
}

export function ZohoDeskSettingsSection() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [appOrigin, setAppOrigin] = useState("");
  const [lastDeskApiVerified, setLastDeskApiVerified] = useState<string | null>(
    null
  );

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAppOrigin(window.location.origin);
    try {
      const v = window.localStorage.getItem("zoho_desk_last_api_ok");
      if (v) setLastDeskApiVerified(v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const tab = p.get("tab");
    if (tab !== "zoho-desk") return;

    const connected = p.get("zoho_desk");
    const err = p.get("zoho_desk_error");
    if (connected === "connected") {
      setBanner({
        type: "ok",
        text: "Zoho Desk connected — refresh token saved. Save organization details if needed, then run Test Desk API.",
      });
      window.history.replaceState({}, "", "/settings?tab=zoho-desk");
      void load().catch(console.error);
    } else if (err) {
      setBanner({
        type: "err",
        text: `Zoho Desk OAuth: ${decodeURIComponent(err)}`,
      });
      window.history.replaceState({}, "", "/settings?tab=zoho-desk");
    }
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    setBanner(null);
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
      toast.showError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function connectZohoDesk() {
    setOauthConnecting(true);
    setBanner(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/zoho-desk/oauth-url");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "OAuth URL failed");
      }
      const url = typeof j.url === "string" ? j.url : "";
      if (!url) throw new Error("No OAuth URL returned");
      window.location.assign(url);
    } catch (err) {
      toast.showError(err instanceof Error ? err.message : "Could not start OAuth");
      setOauthConnecting(false);
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
      if (typeof j.ok === "boolean" && j.ok === true && typeof window !== "undefined") {
        const stamp = new Date().toISOString();
        try {
          window.localStorage.setItem("zoho_desk_last_api_ok", stamp);
        } catch {
          /* ignore */
        }
        setLastDeskApiVerified(stamp);
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
        <p className="text-sm text-black/55">Loading Zoho Desk settings…</p>
      </div>
    );
  }

  const headerStatus = deskHeaderStatus(oauthConnecting, meta);

  let statusHint: string | null = null;
  if (headerStatus === "offline") {
    if (!meta?.readyForOAuth) {
      statusHint = "Save client ID and secret to enable sign-in.";
    } else if (!orgId.trim()) {
      statusHint = "Enter your Desk organization id to create tickets.";
    } else if (!meta?.hasRefreshToken) {
      statusHint = "Connect Zoho or paste a refresh token.";
    } else {
      statusHint = "Complete required fields below.";
    }
  } else if (headerStatus === "connecting") {
    statusHint = "Continuing at Zoho…";
  } else {
    statusHint = "Desk API is authorized for ticketing.";
    if (lastDeskApiVerified) {
      statusHint +=
        ` Tested ${new Date(lastDeskApiVerified).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}.`;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
            Zoho Desk API
          </h2>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
        </div>
        <div className="flex shrink-0 justify-end">
          <DeskStatusPill status={headerStatus} hint={statusHint} />
        </div>
      </div>

      {banner ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
          role="status"
        >
          {banner.text}
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-black/70">
        Separate OAuth client from <strong>Zoho Assist</strong>. Register a client in the{" "}
        <a
          href="https://api-console.zoho.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand underline"
        >
          Zoho API Console
        </a>{" "}
        with scopes{" "}
        <code className="rounded bg-black/5 px-1 text-[11px]">
          Desk.tickets.ALL
        </code>
        ,{" "}
        <code className="rounded bg-black/5 px-1 text-[11px]">Desk.basic.READ</code>
        {" "}
        (required for <strong>Test Desk API</strong>, which lists departments — without it
        Zoho returns <code className="rounded bg-black/5 px-1 text-[11px]">SCOPE_MISMATCH</code>
        ), and{" "}
        <code className="rounded bg-black/5 px-1 text-[11px]">Desk.search.READ</code>
        {" "}
        (required to look up tickets by their <strong>display number</strong>, e.g.{" "}
        <code className="rounded bg-black/5 px-1 text-[11px]">1292</code>). Add the same scopes to this client in the Zoho API Console. Set the authorized redirect URI to{" "}
        <code className="rounded bg-black/5 px-1 text-[11px]">
          {(appOrigin || "https://your-app.example").replace(/\/$/, "")}
          /api/settings/zoho-desk/callback
        </code>
        . If you extend scopes later, click <strong>Connect Zoho Desk</strong> again so the stored refresh
        token includes them. Paste the <strong>organization id</strong> from Zoho Desk (Setup → Developer Space →
        APIs) and optionally a default <strong>department id</strong> for new tickets.
        Save client credentials, then use <strong>Connect Zoho Desk</strong> or paste a refresh
        token. If department is empty, the first department returned by the API is used.
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
            placeholder="Paste from Self Client with Desk scopes, or use Connect Zoho Desk"
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
          <button
            type="button"
            disabled={oauthConnecting || !meta?.readyForOAuth}
            onClick={() => void connectZohoDesk()}
            className="font-heading rounded-lg border-2 border-black bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-black/[0.04] disabled:opacity-50"
          >
            {oauthConnecting ? "Redirecting…" : "Connect Zoho Desk"}
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
