"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  sendEnabled: boolean;
  notifyOnRepair: boolean;
  notifyOnWrittenOff: boolean;
  financeEmails: string;
  financeGreetingName: string;
  fromName: string;
  replyTo: string;
  resendFromEmailConfigured: boolean;
  resendApiKeyConfigured: boolean;
  resolvedFromPreview: string;
};

export function EmailNotificationsSettingsSection() {
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/email-notifications", {
      cache: "no-store",
    });
    const j = (await res.json()) as Row & { error?: string };
    if (!res.ok) throw new Error(j.error ?? "Load failed");
    setData({
      sendEnabled: j.sendEnabled,
      notifyOnRepair: j.notifyOnRepair,
      notifyOnWrittenOff: j.notifyOnWrittenOff,
      financeEmails: j.financeEmails,
      financeGreetingName: j.financeGreetingName,
      fromName: j.fromName,
      replyTo: j.replyTo,
      resendFromEmailConfigured: j.resendFromEmailConfigured,
      resendApiKeyConfigured: j.resendApiKeyConfigured,
      resolvedFromPreview: j.resolvedFromPreview,
    });
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/email-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendEnabled: data.sendEnabled,
          notifyOnRepair: data.notifyOnRepair,
          notifyOnWrittenOff: data.notifyOnWrittenOff,
          financeEmails: data.financeEmails,
          financeGreetingName: data.financeGreetingName,
          fromName: data.fromName,
          replyTo: data.replyTo,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setMessage("Saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function testSend() {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/email-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Test failed");
      setMessage(
        j.id ? `Test email queued (id: ${j.id}).` : "Test email sent."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading || !data) {
    return <p className="text-sm text-black/55">Loading email settings…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          Email &amp; finance notifications
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-black/65">
          Configure optional <strong>Resend</strong> delivery for finance alerts.
          Secrets stay in environment variables (
          <code className="rounded bg-black/[0.06] px-1 text-xs">
            RESEND_API_KEY
          </code>
          ,{" "}
          <code className="rounded bg-black/[0.06] px-1 text-xs">
            RESEND_FROM_EMAIL
          </code>
          ). You can save toggles and recipients now and enable sending when the
          domain is verified in Resend.
        </p>
        <ul className="mt-3 list-inside list-disc text-xs text-black/55">
          <li>
            API key configured:{" "}
            <strong>{data.resendApiKeyConfigured ? "Yes" : "No"}</strong>
          </li>
          <li>
            From email (env):{" "}
            <strong>
              {data.resendFromEmailConfigured ? "Set" : "Not set"}
            </strong>
          </li>
          <li>
            Resolved From header:{" "}
            <span className="font-mono text-[11px]">
              {data.resolvedFromPreview || "—"}
            </span>
          </li>
        </ul>
      </div>

      <form onSubmit={save} className="max-w-xl space-y-4">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={data.sendEnabled}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, sendEnabled: e.target.checked } : d
              )
            }
            className="mt-1"
          />
          <span className="text-sm text-black/80">
            <strong>Enable sending</strong> — when off, acknowledgement rows are
            still created; emails are skipped.
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={data.notifyOnRepair}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, notifyOnRepair: e.target.checked } : d
              )
            }
            className="mt-1"
          />
          <span className="text-sm text-black/80">
            Notify finance when a <strong>repair</strong> is logged
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={data.notifyOnWrittenOff}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, notifyOnWrittenOff: e.target.checked } : d
              )
            }
            className="mt-1"
          />
          <span className="text-sm text-black/80">
            Notify finance when an asset is <strong>written off</strong>
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            Finance emails (comma-separated)
          </span>
          <input
            type="text"
            value={data.financeEmails}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, financeEmails: e.target.value } : d
              )
            }
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            placeholder="finance@handicaps.co.za, lerisha@handicaps.co.za"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            Greeting name (optional)
          </span>
          <input
            type="text"
            value={data.financeGreetingName}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, financeGreetingName: e.target.value } : d
              )
            }
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            placeholder="Lerisha"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            From display name
          </span>
          <input
            type="text"
            value={data.fromName}
            onChange={(e) =>
              setData((d) => (d ? { ...d, fromName: e.target.value } : d))
            }
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            Reply-to (optional)
          </span>
          <input
            type="email"
            value={data.replyTo}
            onChange={(e) =>
              setData((d) => (d ? { ...d, replyTo: e.target.value } : d))
            }
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
            placeholder="inventory@handicaps.co.za"
          />
        </label>

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

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="font-heading rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={testing || saving}
            onClick={() => void testSend()}
            className="rounded-lg border border-black/15 px-5 py-2.5 text-sm font-medium text-black/80 hover:bg-black/[0.04] disabled:opacity-50"
          >
            {testing ? "Sending…" : "Send test email"}
          </button>
        </div>
      </form>
    </div>
  );
}
