"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppRole } from "@/components/RoleProvider";
import { SectionSkeleton } from "@/components/Skeleton";
import { isReportsAdmin } from "@/lib/auth/reports-admin";
import { formatDateTime } from "@/lib/dates/format";

type FinancePackMonth = {
  monthKey: string;
  monthEndingLabel: string;
  sentAt: string | null;
  recipientCount: number;
  recipients: string[];
  generatedBy: string | null;
  hasCsv: boolean;
  fileHashes: Record<string, string>;
  newStock: number;
  refurbished: number;
  usable: number;
  deployed: number;
  assessment: number;
  inRepair: number;
  writtenOff: number;
  register: number;
  modelCount: number;
};

type SendLogRow = {
  id: string;
  monthKey: string;
  mode: string;
  status: string;
  reason: string | null;
  sent: number;
  failed: number;
  error: string | null;
  createdAt: string;
};

type PackKind = "reconcile" | "breakdown" | "month-on-month" | "yearly" | "field" | "csv";

const FILES: { kind: PackKind; label: string }[] = [
  { kind: "reconcile", label: "Reconcile" },
  { kind: "breakdown", label: "Breakdown" },
  { kind: "month-on-month", label: "Month on month" },
  { kind: "yearly", label: "Yearly" },
  { kind: "field", label: "Field listing" },
  { kind: "csv", label: "CSV" },
];

const MODE_LABEL: Record<string, string> = {
  cron: "Scheduled",
  send_now: "Send now",
  resend: "Resend",
  manual_test: "Test (not stored)",
};

function fileHref(monthKey: string, kind: PackKind, download = false) {
  const base = `/api/reports/finance-packs/pdf?month=${encodeURIComponent(monthKey)}&kind=${kind}`;
  return download ? `${base}&download=1` : base;
}

function hashFor(month: FinancePackMonth, kind: PackKind): string | undefined {
  const suffix = {
    reconcile: "reconcile",
    breakdown: "breakdown",
    "month-on-month": "month-on-month",
    yearly: "yearly",
    field: "field",
    csv: ".csv",
  }[kind];
  const entry = Object.entries(month.fileHashes).find(([path]) => path.includes(suffix));
  return entry?.[1];
}

export function FinancePacksSection() {
  const { role } = useAppRole();
  const canSend = isReportsAdmin(role);
  const [months, setMonths] = useState<FinancePackMonth[] | null>(null);
  const [sendLog, setSendLog] = useState<SendLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reports/finance-packs");
      if (!res.ok) throw new Error("Could not load official finance packs");
      const body = (await res.json()) as { months: FinancePackMonth[]; sendLog: SendLogRow[] };
      setMonths(body.months);
      setSendLog(body.sendLog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load official finance packs");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(action: "send_now" | "resend", monthKey?: string) {
    const prompt =
      action === "send_now"
        ? "Store last month's pack and email it to finance now?"
        : `Email the stored ${monthKey} pack to finance again?`;
    if (!window.confirm(prompt)) return;
    setBusy(monthKey ?? "send_now");
    setMessage(null);
    try {
      const res = await fetch("/api/reports/finance-packs/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, monthKey }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        skipped?: string;
        sent?: number;
        failed?: number;
        monthLabel?: string;
        error?: string;
      };
      if (body.skipped === "already_sent") setMessage(`${body.monthLabel} was already sent.`);
      else if (!res.ok || !body.ok) setMessage(body.error ?? "The send did not complete");
      else setMessage(`${body.monthLabel}: ${body.sent} sent, ${body.failed ?? 0} failed.`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="finance-packs" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <h3 className="font-heading text-base font-bold text-ink">Stored monthly packs</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            On the 1st (SAST) last month&apos;s pack is stored first, then emailed to finance once; a failed email is
            retried daily and a stored month is never replaced.
          </p>
        </div>
        {canSend ? (
          <button
            type="button"
            className="btn-secondary py-2 text-xs"
            disabled={busy !== null}
            onClick={() => send("send_now")}
          >
            {busy === "send_now" ? "Sending…" : "Send last month now"}
          </button>
        ) : null}
      </header>

      {message ? <p className="rounded-lg border border-line bg-white px-4 py-3 text-sm">{message}</p> : null}

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : months === null ? (
        <SectionSkeleton label="Loading official finance packs" />
      ) : months.length === 0 ? (
        <p className="text-sm text-muted">
          No pack is stored yet. October 2026 is the first month this system keeps; July to September 2026 were emailed
          but not stored (see History).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Report month</th>
                <th className="px-4 py-3 text-right font-medium">New</th>
                <th className="px-4 py-3 text-right font-medium">Refurbished</th>
                <th className="px-4 py-3 text-right font-medium">Deployed</th>
                <th className="px-4 py-3 text-right font-medium">Assessment</th>
                <th className="px-4 py-3 text-right font-medium">In repairs</th>
                <th className="px-4 py-3 text-right font-medium">Written off</th>
                <th className="px-4 py-3 text-right font-medium">Register</th>
                <th className="px-4 py-3 font-medium">Files</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month.monthKey} className="border-b border-line align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{month.monthEndingLabel}</div>
                    <div className="text-xs text-muted">
                      {month.sentAt
                        ? `Emailed ${formatDateTime(month.sentAt)} to ${month.recipientCount}`
                        : "Stored, not emailed yet"}
                    </div>
                    {month.recipients.length > 0 ? (
                      <div className="text-xs text-muted">{month.recipients.join(", ")}</div>
                    ) : null}
                    {canSend ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-medium text-brand-deep hover:underline disabled:opacity-50"
                        disabled={busy !== null}
                        onClick={() => send("resend", month.monthKey)}
                      >
                        {busy === month.monthKey ? "Sending…" : month.sentAt ? "Resend" : "Send"}
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.newStock}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.refurbished}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.deployed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.assessment}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.inRepair}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.writtenOff}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{month.register}</td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1">
                      {FILES.filter((file) => file.kind !== "csv" || month.hasCsv).map((file) => {
                        const hash = hashFor(month, file.kind);
                        return (
                          <li key={file.kind} className="flex items-baseline gap-2">
                            <a
                              href={fileHref(month.monthKey, file.kind)}
                              target={file.kind === "csv" ? undefined : "_blank"}
                              rel="noopener noreferrer"
                              className="font-medium text-brand-deep hover:underline"
                            >
                              {file.label}
                            </a>
                            {file.kind !== "csv" ? (
                              <a href={fileHref(month.monthKey, file.kind, true)} className="text-xs text-muted hover:underline">
                                Download
                              </a>
                            ) : null}
                            {hash ? (
                              <span
                                className="text-[10px] text-muted underline decoration-dotted underline-offset-2"
                                title={`Kept exactly as sent. SHA-256 ${hash}`}
                              >
                                unchanged
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sendLog.length > 0 ? (
        <details className="section-card p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">Send history ({sendLog.length})</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">When (SAST)</th>
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 font-medium">How</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {sendLog.map((row) => (
                  <tr key={row.id} className="border-b border-line">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                    <td className="px-3 py-2">{row.monthKey}</td>
                    <td className="px-3 py-2">{MODE_LABEL[row.mode] ?? row.mode}</td>
                    <td className="px-3 py-2">
                      {row.status === "sent"
                        ? `Sent to ${row.sent}${row.failed ? `, ${row.failed} failed` : ""}`
                        : row.status === "skipped"
                          ? `Skipped (${row.reason ?? "no reason"})`
                          : `Failed: ${row.error ?? "unknown error"}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
