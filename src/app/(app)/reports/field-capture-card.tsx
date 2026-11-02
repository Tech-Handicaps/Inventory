"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates/format";
import { captureArithmetic, MODEL_ROW_NOTES, type CaptureArithmetic } from "@/lib/reports/field-export";
import type { ReconciliationView } from "@/lib/reports/load-reconciliation";
import { monthLabelOf } from "@/lib/reports/period-catalog";

function Arithmetic({ a }: { a: CaptureArithmetic }) {
  const rows: [string, number][] = [
    ["captured: matched to a Deployed unit at the same club", a.matched],
    ["not yet captured (list below)", a.notCaptured],
  ];
  const extra: [string, number][] = [
    ["matched to an HNA-owned export terminal (captured)", a.matched],
    ["at sites not in the export", a.outsideExport],
    ["at clubs whose export rows are all club-owned or unowned", a.noHnaRows],
    ["extra units at a club beyond its HNA-owned export rows", a.beyondExportCount],
  ];
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-slate-50 p-4 text-sm md:grid-cols-2">
      <div>
        <p className="font-semibold text-ink">{a.hnaOwned} HNA-owned terminals in the export</p>
        <ul className="mt-1 space-y-0.5 text-ink">
          {rows.map(([label, n]) => (
            <li key={label} className="flex justify-between gap-3">
              <span>{label}</span>
              <span className="tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold text-ink">{a.deployed} Deployed in the register</p>
        <ul className="mt-1 space-y-0.5 text-ink">
          {extra.map(([label, n]) => (
            <li key={label} className="flex justify-between gap-3">
              <span>{label}</span>
              <span className="tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted md:col-span-2">
        {a.matched} captured + {a.notCaptured} not yet captured = {a.hnaOwned} HNA-owned terminals. These are the only
        captured and not-yet-captured figures on this report: the headline, the model, club and month tables all use them.
        The {a.notMatched} Deployed unit(s) that match no HNA-owned export terminal are listed below and are not counted as
        captured.
      </p>
    </div>
  );
}

function Trend({ view }: { view: ReconciliationView }) {
  const t = view.captureTrend;
  const max = Math.max(view.fieldCapture.baseline.hnaOwned, 1);
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-ink">Captured by month</h4>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <Th>Month end</Th>
              <Th num>Captured</Th>
              <Th num>% of HNA-owned</Th>
              <Th>
                <span className="sr-only">Bar</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {t.points.map((p) => (
              <tr key={p.monthKey} className="border-b border-line">
                <Td>
                  {monthLabelOf(p.monthKey)}
                  {p.toDate ? <span className="ml-1 text-xs text-muted">(to date)</span> : null}
                </Td>
                <Td num>{p.captured}</Td>
                <Td num>{p.pct}%</Td>
                <td className="w-1/2 px-3 py-2">
                  <div className="h-2 rounded-full bg-slate-100" aria-hidden>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(p.captured / max) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-3xl text-xs text-muted">
        At each month end (SAST): the hardware Deployed at that time, replayed for each asset from the audit log (which
        starts with the first asset on 18 April 2026), matched to the export with the same rule as above, using each
        unit&apos;s current club. The replay is checked against today&apos;s register. Deleted records are not counted.
        {t.unreconciled
          ? ` For ${t.unreconciled} asset(s) the replay does not end at today's status, so earlier months may be off by up to that number.`
          : ""}
      </p>
    </div>
  );
}

const CLUB_PAGE = 25;

function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return <th className={`px-3 py-2 font-medium ${num ? "text-right" : ""}`}>{children}</th>;
}

function Td({ children, num, muted }: { children: React.ReactNode; num?: boolean; muted?: boolean }) {
  return (
    <td className={`px-3 py-2 ${num ? "text-right tabular-nums" : ""} ${muted ? "text-xs text-muted" : ""}`}>{children}</td>
  );
}

export function FieldCaptureCard({ view }: { view: ReconciliationView }) {
  const fc = view.fieldCapture;
  const b = fc.baseline;
  const bd = fc.breakdown;
  const [query, setQuery] = useState("");
  const [gapsOnly, setGapsOnly] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const q = query.trim().toLowerCase();
  const clubs = useMemo(() => {
    if (!bd) return [];
    return bd.byClub.filter(
      (c) =>
        (!gapsOnly || c.notYetCaptured > 0) &&
        (!q || c.club.toLowerCase().includes(q) || c.clubId === q || c.exportModels.toLowerCase().includes(q))
    );
  }, [bd, gapsOnly, q]);
  const terminals = useMemo(() => {
    if (!bd) return [];
    return bd.notCaptured.filter(
      (t) => !q || t.club.toLowerCase().includes(q) || t.terminalId.includes(q) || t.model.toLowerCase().includes(q)
    );
  }, [bd, q]);

  const deployed = view.register.hardware.deployed;
  const total = (key: "sameModel" | "otherModel") => (bd ? bd.byModel.reduce((s, m) => s + m[key], 0) : 0);

  return (
    <section className="section-card space-y-5 p-5">
      <div className="space-y-1">
        <h3 className="font-heading text-base font-bold text-ink">Field capture in progress</h3>
        <p className="max-w-3xl text-sm text-muted">
          Measured against the field terminal export dated {formatDate(b.exportDate)} ({b.fileName}): {b.terminalsAtClubs}{" "}
          terminals at {b.clubIds} clubs, of which {b.hnaOwned} are HNA-owned, {b.clubOwned} club-owned and{" "}
          {b.blankOwnership} have no owner recorded. This is capture still to be done, not a loss or a variance.
        </p>
      </div>
      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="h-full bg-brand" style={{ width: `${Math.min(100, fc.capturedPct)}%` }} />
        </div>
        <p className="text-sm text-ink">
          <strong>{fc.captured}</strong> of {b.hnaOwned} HNA-owned terminals captured ({fc.capturedPct}%);{" "}
          {fc.notYetCaptured} not yet captured.
          {fc.matched
            ? " A terminal counts as captured when a Deployed unit is recorded at its club."
            : ` Estimate: the stored export could not be read, so this is the ${fc.deployed} Deployed units, at most ${b.hnaOwned}.`}
        </p>
      </div>

      {!bd ? (
        <p className="text-sm text-muted">
          The stored export could not be read, so the breakdown by model and club is not available right now.
        </p>
      ) : (
        <>
          <Arithmetic a={captureArithmetic(deployed, b.hnaOwned, bd)} />
          <Trend view={view} />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-ink">By model</h4>
            <div className="overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <Th>Model in the export</Th>
                    <Th num>HNA-owned in export</Th>
                    <Th num>Captured by the same model</Th>
                    <Th num>Captured by another model</Th>
                    <Th num>Not yet captured</Th>
                  </tr>
                </thead>
                <tbody>
                  {bd.byModel.map((m) => (
                    <tr key={m.model} className="border-b border-line">
                      <Td>
                        {m.model}
                        {MODEL_ROW_NOTES[m.model] ? (
                          <span className="block text-xs text-amber-800">{MODEL_ROW_NOTES[m.model]}</span>
                        ) : null}
                      </Td>
                      <Td num>{m.inExport}</Td>
                      <Td num>{m.sameModel || "–"}</Td>
                      <Td num>{m.otherModel || "–"}</Td>
                      <Td num>{m.notYetCaptured || "–"}</Td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <Td>Total</Td>
                    <Td num>{b.hnaOwned}</Td>
                    <Td num>{total("sameModel")}</Td>
                    <Td num>{total("otherModel")}</Td>
                    <Td num>{fc.notYetCaptured}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="max-w-3xl text-xs text-muted">
              {`Captured by the same model + by another model = ${fc.captured} captured. `}&ldquo;Another model&rdquo; means the
              club&apos;s terminal position is filled by a different model in the register
              {bd.crossModel.length
                ? ` (${bd.crossModel.map((c) => `${c.count} ${c.exportModel} by ${c.registerModel}`).join(", ")})`
                : ""}
              ; the register keeps the model it holds, nothing is merged or aliased. Lenovo M810z and Lenovo 10Q0 are
              different models. An NUC is counted once whichever screen it came with. Spellings are combined through the
              alias table.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h4 className="text-sm font-semibold text-ink">By club</h4>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  className="input-field w-56 px-2 py-1.5 text-sm"
                  placeholder="Search club, ID, model or terminal"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search the field capture breakdown"
                />
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} />
                  Only clubs with terminals not yet captured
                </label>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <Th>Club ID</Th>
                    <Th>Club</Th>
                    <Th>HNA-owned terminals in export</Th>
                    <Th num>In export</Th>
                    <Th num>Captured</Th>
                    <Th num>Not yet</Th>
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? clubs : clubs.slice(0, CLUB_PAGE)).map((c) => (
                    <tr key={`${c.clubId}-${c.club}`} className="border-b border-line">
                      <Td muted>{c.clubId}</Td>
                      <Td>{c.club}</Td>
                      <Td muted>{c.exportModels || "None (club-owned only)"}</Td>
                      <Td num>{c.inExport}</Td>
                      <Td num>{c.captured}</Td>
                      <Td num>{c.notYetCaptured || "–"}</Td>
                    </tr>
                  ))}
                  {clubs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-sm text-muted">
                        No clubs match.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {clubs.length > CLUB_PAGE ? (
              <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer" : `Show all ${clubs.length} clubs`}
              </button>
            ) : null}
          </div>

          <details className="rounded-lg border border-line bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Terminals not yet captured ({bd.notCaptured.length}) – list for technicians
            </summary>
            <p className="mt-2 max-w-3xl text-xs text-muted">
              The register does not hold terminal IDs, so units are matched by club (same model first). Capture each one with
              its serial number; nothing is created automatically from the export.
            </p>
            <div className="mt-3 max-h-96 overflow-auto rounded border border-line">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-line">
                    <Th>Terminal ID</Th>
                    <Th>Club</Th>
                    <Th>Model in export</Th>
                  </tr>
                </thead>
                <tbody>
                  {terminals.map((t) => (
                    <tr key={t.terminalId} className="border-b border-line">
                      <Td>
                        <span className="font-mono text-xs">{t.terminalId}</span>
                      </Td>
                      <Td>
                        {t.club} <span className="text-xs text-muted">({t.clubId})</span>
                      </Td>
                      <Td>{t.model}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {bd.outsideExport.length + bd.unmatchedAtClubs.length ? (
            <details className="rounded-lg border border-line bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Deployed units that match no HNA-owned export terminal ({bd.outsideExport.length + bd.unmatchedAtClubs.length})
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {bd.outsideExport.map((u) => (
                  <li key={u.assetName + (u.serialNumber ?? "")}>
                    {u.assetName} · {u.model} · {u.club ?? <span className="text-muted">no club recorded</span>}{" "}
                    <span className="text-xs text-muted">– site not in the export</span>
                  </li>
                ))}
                {bd.unmatchedAtClubs.map((u) => (
                  <li key={u.assetName}>
                    {u.assetName} · {u.model} · {u.club}{" "}
                    <span className="text-xs text-muted">
                      –{" "}
                      {u.reason === "no_hna_rows"
                        ? "the export lists only club-owned or unowned terminals here"
                        : "more units here than HNA-owned export rows"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="max-w-3xl text-xs text-muted">
            Not counted towards the capture figure: {b.clubOwned} club-owned terminals (
            {bd.clubOwnedByModel.map((m) => `${m.count} ${m.model}`).join(", ")})
            {bd.blankOwnership.length
              ? ` and ${bd.blankOwnership.length} with no owner recorded (${bd.blankOwnership
                  .map((t) => `${t.model} at ${t.club}`)
                  .join("; ")})`
              : ""}
            .
          </p>
        </>
      )}
    </section>
  );
}
