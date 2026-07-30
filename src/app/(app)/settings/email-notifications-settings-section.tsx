"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmailTransportId } from "@/lib/email/email-notification-copy";
import {
  describeSenderBlockedReason,
  EMAIL_DELIVERY_OPTIONS,
  EMAIL_TRANSPORT_LABEL,
  parseEmailTransport,
} from "@/lib/email/email-notification-copy";

type EmailSettingsRow = {
  emailTransport: EmailTransportId;
  sendEnabled: boolean;
  notifyOnRepair: boolean;
  notifyOnAssessment: boolean;
  notifyOnWrittenOff: boolean;
  notifyOnDispatch: boolean;
  notifyOnRefurbished: boolean;
  financeEmails: string;
  financeGreetingName: string;
  fromName: string;
  replyTo: string;
  scheduleReconcileEnabled: boolean;
  scheduleReconcileDayOfMonth: number;
  scheduleReconcileLastSentMonth: string | null;
  resendFromEmailConfigured: boolean;
  resendApiKeyConfigured: boolean;
  smtpEnvConfigured: boolean;
  senderConfigured: boolean;
  senderBlockedReason: string | null;
  resolvedFromPreview: string;
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-sm";

function mapApiToRow(j: EmailSettingsRow & { error?: string }): EmailSettingsRow {
  return {
    emailTransport: parseEmailTransport(j.emailTransport),
    sendEnabled: j.sendEnabled,
    notifyOnRepair: j.notifyOnRepair,
    notifyOnAssessment: j.notifyOnAssessment ?? true,
    notifyOnWrittenOff: j.notifyOnWrittenOff,
    notifyOnDispatch: j.notifyOnDispatch ?? true,
    notifyOnRefurbished: j.notifyOnRefurbished ?? true,
    financeEmails: j.financeEmails,
    financeGreetingName: j.financeGreetingName,
    fromName: j.fromName,
    replyTo: j.replyTo,
    scheduleReconcileEnabled: j.scheduleReconcileEnabled ?? false,
    scheduleReconcileDayOfMonth: j.scheduleReconcileDayOfMonth ?? 1,
    scheduleReconcileLastSentMonth: j.scheduleReconcileLastSentMonth ?? null,
    resendFromEmailConfigured: j.resendFromEmailConfigured,
    resendApiKeyConfigured: j.resendApiKeyConfigured,
    smtpEnvConfigured: j.smtpEnvConfigured ?? false,
    senderConfigured: j.senderConfigured ?? false,
    senderBlockedReason: j.senderBlockedReason ?? null,
    resolvedFromPreview: j.resolvedFromPreview,
  };
}

export function EmailNotificationsSettingsSection() {
  const [data, setData] = useState<EmailSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingReconcile, setSendingReconcile] = useState(false);
  const [testToEmail, setTestToEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/email-notifications", {
      cache: "no-store",
    });
    const j = (await res.json()) as EmailSettingsRow & { error?: string };
    if (!res.ok) throw new Error(j.error ?? "Load failed");
    setData(mapApiToRow(j));
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
          emailTransport: data.emailTransport,
          sendEnabled: data.sendEnabled,
          notifyOnRepair: data.notifyOnRepair,
          notifyOnAssessment: data.notifyOnAssessment,
          notifyOnWrittenOff: data.notifyOnWrittenOff,
          notifyOnDispatch: data.notifyOnDispatch,
          notifyOnRefurbished: data.notifyOnRefurbished,
          financeEmails: data.financeEmails,
          financeGreetingName: data.financeGreetingName,
          fromName: data.fromName,
          replyTo: data.replyTo,
          scheduleReconcileEnabled: data.scheduleReconcileEnabled,
          scheduleReconcileDayOfMonth: data.scheduleReconcileDayOfMonth,
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
      const to = testToEmail.trim();
      const res = await fetch("/api/settings/email-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(to ? { to } : {}),
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

  async function sendReconcileNow() {
    setSendingReconcile(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/email-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reconcile" }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
        failed?: number;
        monthLabel?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Reconcile send failed");
      setMessage(
        `Monthly reconcile sent${j.monthLabel ? ` for ${j.monthLabel}` : ""} (${j.sent ?? 0} recipient${(j.sent ?? 0) === 1 ? "" : "s"}${j.failed ? `, ${j.failed} failed` : ""}).`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconcile send failed");
    } finally {
      setSendingReconcile(false);
    }
  }

  if (loading || !data) {
    return <p className="text-sm text-black/55">Loading email settings…</p>;
  }

  const blockedHint = describeSenderBlockedReason(data.senderBlockedReason);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
          Email &amp; finance notifications
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-black/65">
          Choose <strong>Resend HTTP API</strong> or <strong>SMTP</strong> (e.g.
          Resend’s SMTP relay or Microsoft 365). When SMTP is selected, the app
          does not call the Resend REST API. Secrets stay in environment
          variables only.
        </p>
        <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
            Environment status
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-black/55">
            <li>
              Transport:{" "}
              <strong className="text-black/80">
                {EMAIL_TRANSPORT_LABEL[data.emailTransport]}
              </strong>
            </li>
            <li>
              From address (one of{" "}
              <code className="text-[11px]">SMTP_FROM</code>,{" "}
              <code className="text-[11px]">EMAIL_FROM</code>,{" "}
              <code className="text-[11px]">RESEND_FROM_EMAIL</code>):{" "}
              <strong className="text-black/80">
                {data.resendFromEmailConfigured ? "Set" : "Not set"}
              </strong>
            </li>
            <li>
              Resend API key (REST only):{" "}
              <strong className="text-black/80">
                {data.resendApiKeyConfigured ? "Yes" : "No"}
              </strong>
            </li>
            <li>
              SMTP env (host + user + password):{" "}
              <strong className="text-black/80">
                {data.smtpEnvConfigured ? "Yes" : "No"}
              </strong>
            </li>
            <li>
              Ready to send:{" "}
              <strong className="text-black/80">
                {data.senderConfigured ? "Yes" : "No"}
              </strong>
              {blockedHint ? (
                <span className="ml-1 text-black/45">({blockedHint})</span>
              ) : null}
            </li>
            {data.resolvedFromPreview ? (
              <li>
                From preview:{" "}
                <code className="text-[11px] text-black/70">
                  {data.resolvedFromPreview}
                </code>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <form onSubmit={save} className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-black/70">
            Delivery method
          </legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {EMAIL_DELIVERY_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-black/10 px-3 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand/5"
              >
                <input
                  type="radio"
                  name="emailTransport"
                  checked={data.emailTransport === opt.id}
                  onChange={() =>
                    setData((d) => (d ? { ...d, emailTransport: opt.id } : d))
                  }
                  className="mt-1"
                />
                <span className="text-sm text-black/80">
                  <strong>{opt.title}</strong>
                  <span className="mt-0.5 block text-xs text-black/50">
                    {opt.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
            still created; emails are skipped. Scheduled monthly reconcile also
            respects this switch.
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={data.notifyOnAssessment}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, notifyOnAssessment: e.target.checked } : d
              )
            }
            className="mt-1"
          />
          <span className="text-sm text-black/80">
            Notify finance when hardware enters <strong>Assessment/Maintenance</strong>{" "}
            (triage, reloads, or light depot work before a repair)
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
            checked={data.notifyOnDispatch}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, notifyOnDispatch: e.target.checked } : d
              )
            }
            className="mt-1"
          />
          <span className="text-sm text-black/80">
            Notify finance with a <strong>dispatch voucher</strong> (PDF attached)
            when hardware moves from <strong>Assessment/Maintenance</strong> or{" "}
            <strong>In repairs</strong> to <strong>Deployed</strong>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={data.notifyOnRefurbished}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, notifyOnRefurbished: e.target.checked } : d
              )
            }
            className="mt-1"
          />
          <span className="text-sm text-black/80">
            Notify finance when hardware moves from{" "}
            <strong>Assessment/Maintenance</strong> to <strong>Refurbished</strong>{" "}
            (booked into refurbishment, ready for redistribution)
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
            Finance emails
          </span>
          <textarea
            value={data.financeEmails}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, financeEmails: e.target.value } : d
              )
            }
            className={`${fieldClass} min-h-[88px] font-mono text-[13px]`}
            placeholder={`Jane Smith <jane@handicaps.co.za>\nAudit Desk <audit@handicaps.co.za>\nfinance@handicaps.co.za`}
          />
          <span className="mt-1 block text-xs text-black/50">
            One per line (or comma-separated). Prefer{" "}
            <code className="text-[11px]">Name &lt;email@domain&gt;</code> so{" "}
            <code className="text-[11px]">{"{name}"}</code> personalizes each
            message. Plain emails fall back to the greeting name below.
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            Send test email to (optional)
          </span>
          <input
            type="email"
            value={testToEmail}
            onChange={(e) => setTestToEmail(e.target.value)}
            className={fieldClass}
            placeholder="your@email.com — overrides finance list for test only"
          />
          <span className="mt-1 block text-xs text-black/50">
            If empty, the test goes to the <strong>first</strong> finance email
            above (after you have saved at least one address).
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-black/70">
            Fallback greeting name (optional)
          </span>
          <input
            type="text"
            value={data.financeGreetingName}
            onChange={(e) =>
              setData((d) =>
                d ? { ...d, financeGreetingName: e.target.value } : d
              )
            }
            className={fieldClass}
            placeholder="Finance team"
          />
          <span className="mt-1 block text-xs text-black/50">
            Used when a recipient has no display name. Default is{" "}
            <strong>Finance team</strong>. You can also use a template such as{" "}
            <code className="text-[11px]">{"Hi {name},"}</code>.
          </span>
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
            className={fieldClass}
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
            className={fieldClass}
            placeholder="inventory@handicaps.co.za"
          />
        </label>

        <section className="rounded-xl border border-black/10 bg-black/[0.02] p-4 space-y-4">
          <div>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
              Scheduled reports
            </h3>
            <p className="mt-1 text-sm text-black/60">
              Email the <strong>Monthly Stock Reconcile</strong> PDF to the
              finance list above. Runs daily at 06:00 UTC and only sends on the
              chosen day in Africa/Johannesburg (once per month).
            </p>
          </div>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={data.scheduleReconcileEnabled}
              onChange={(e) =>
                setData((d) =>
                  d
                    ? { ...d, scheduleReconcileEnabled: e.target.checked }
                    : d
                )
              }
              className="mt-1"
            />
            <span className="text-sm text-black/80">
              Send <strong>Monthly Stock Reconcile</strong> automatically
            </span>
          </label>

          <label className="block max-w-xs">
            <span className="text-xs font-medium text-black/70">
              Day of month (1–28)
            </span>
            <input
              type="number"
              min={1}
              max={28}
              value={data.scheduleReconcileDayOfMonth}
              onChange={(e) =>
                setData((d) =>
                  d
                    ? {
                        ...d,
                        scheduleReconcileDayOfMonth: Math.min(
                          28,
                          Math.max(1, Number(e.target.value) || 1)
                        ),
                      }
                    : d
                )
              }
              className={fieldClass}
            />
          </label>

          {data.scheduleReconcileLastSentMonth ? (
            <p className="text-xs text-black/50">
              Last scheduled send:{" "}
              <strong className="text-black/70">
                {data.scheduleReconcileLastSentMonth}
              </strong>
            </p>
          ) : (
            <p className="text-xs text-black/50">
              No scheduled send recorded yet.
            </p>
          )}

          <button
            type="button"
            disabled={sendingReconcile || saving}
            onClick={() => void sendReconcileNow()}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/[0.04] disabled:opacity-50"
          >
            {sendingReconcile
              ? "Sending reconcile…"
              : "Send monthly reconcile now"}
          </button>
        </section>

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
