"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates/format";
import type { ReconciliationView } from "@/lib/reports/load-reconciliation";

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
  const surplusAtClubs = bd ? deployed - bd.outsideExport.length - (b.hnaOwned - bd.notCaptured.length) : 0;
  const modelGap = bd ? bd.byModel.reduce((s, m) => s + m.notYetCaptured, 0) : 0;
  const beyondExport = bd ? bd.byModel.reduce((s, m) => s + m.beyondExport, 0) : 0;

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
          <strong>{fc.captured}</strong> of {b.hnaOwned} HNA-owned terminals captured in the register as Deployed (
          {fc.capturedPct}%); {fc.notYetCaptured} not yet captured.
        </p>
      </div>

      {!bd ? (
        <p className="text-sm text-muted">
          The stored export could not be read, so the breakdown by model and club is not available right now.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-ink">By model</h4>
            <div className="overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <Th>Model</Th>
                    <Th num>HNA-owned in export</Th>
                    <Th num>Captured (Deployed)</Th>
                    <Th num>Not yet captured</Th>
                  </tr>
                </thead>
                <tbody>
                  {bd.byModel.map((m) => (
                    <tr key={m.model} className="border-b border-line">
                      <Td>
                        {m.model}
                        {m.inExport === 0 ? (
                          <span className="ml-2 text-xs text-muted">not named in the export</span>
                        ) : null}
                      </Td>
                      <Td num>{m.inExport}</Td>
                      <Td num>{m.captured}</Td>
                      <Td num>{m.notYetCaptured || "–"}</Td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <Td>Total</Td>
                    <Td num>{b.hnaOwned}</Td>
                    <Td num>{deployed}</Td>
                    <Td num>{modelGap}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="max-w-3xl text-xs text-muted">
              Lenovo M810z and Lenovo 10Q0 are kept apart: the export names M810z, while the register&apos;s Lenovo units
              are 10Q0, so both show until a technician confirms the model at the club. An NUC is counted once whichever
              screen it came with. Spellings are combined through the alias table below.
              {modelGap !== fc.notYetCaptured
                ? ` Per model the gaps add up to ${modelGap} rather than ${fc.notYetCaptured}, because ${beyondExport} deployed unit(s) are models the export does not name, or more units of a model than the export lists.`
                : ""}
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
              {bd.notCaptured.length !== fc.notYetCaptured
                ? ` The list has ${bd.notCaptured.length} rows rather than ${fc.notYetCaptured} because ${bd.outsideExport.length} deployed unit(s) are at sites not in the export and ${Math.max(surplusAtClubs, 0)} are extra units at a club beyond its export count.`
                : ""}
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

          {bd.outsideExport.length ? (
            <details className="rounded-lg border border-line bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Deployed at sites not in this export ({bd.outsideExport.length})
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {bd.outsideExport.map((u) => (
                  <li key={u.assetName + (u.serialNumber ?? "")}>
                    {u.assetName} · {u.model} · {u.club ?? <span className="text-muted">no club recorded</span>}
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
