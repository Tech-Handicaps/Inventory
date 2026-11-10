"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReservationDialog } from "@/components/ReservationDialog";
import { StartAssessmentModal } from "@/components/StartAssessmentModal";
import { useToast } from "@/components/ToastProvider";
import { CameraScanner } from "@/components/scan/CameraScanner";
import { STAGE_DOT, isDepotStock, type BoardAsset } from "@/components/board/types";
import { reservationLabel } from "@/lib/finance/reservation-shared";
import { HARDWARE_CREATED_EVENT, openAddHardware } from "@/lib/client/add-hardware";
import { displayAssetModel } from "@/lib/inventory/asset-hardware-display";

type SerialCandidate = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  status: { code: string; label: string };
  club: { name: string } | null;
};

type LookupResponse = {
  parsed: { kind: "asset_id" | "serial"; raw: string; serial?: string; assetId?: string };
  asset: BoardAsset | null;
  matchedBy: "asset_link" | "serial" | "asset_name" | null;
  unitsWithoutSerial?: SerialCandidate[];
};

type ScanState =
  | { phase: "scanning" }
  | { phase: "looking"; code: string }
  | { phase: "result"; code: string; data: LookupResponse }
  | { phase: "error"; code: string; message: string };

const MATCH_LABEL = {
  asset_link: "Matched by asset QR link",
  serial: "Matched by serial number",
  asset_name: "Matched by asset name",
} as const;

export function ScanClient() {
  const toast = useToast();
  const [state, setState] = useState<ScanState>({ phase: "scanning" });
  const [manual, setManual] = useState("");
  const [reserveAsset, setReserveAsset] = useState<BoardAsset | null>(null);
  const [assessAsset, setAssessAsset] = useState<BoardAsset | null>(null);

  const lookup = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setState({ phase: "looking", code: trimmed });
    try {
      const res = await fetch(`/api/assets/scan?code=${encodeURIComponent(trimmed)}`);
      const j = (await res.json().catch(() => ({}))) as LookupResponse & { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : `Lookup failed (${res.status})`);
      setState({ phase: "result", code: trimmed, data: j });
    } catch (e) {
      setState({ phase: "error", code: trimmed, message: e instanceof Error ? e.message : "Lookup failed" });
    }
  }, []);

  const currentCode = state.phase === "scanning" ? null : state.code;

  useEffect(() => {
    if (!currentCode) return;
    const onCreated = () => void lookup(currentCode);
    window.addEventListener(HARDWARE_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(HARDWARE_CREATED_EVENT, onCreated);
  }, [currentCode, lookup]);

  const scanNext = () => {
    setManual("");
    setState({ phase: "scanning" });
  };

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
      <PageHeader
        title="Scan hardware"
        description="Point the camera at a serial barcode or QR code."
        help={
          <>
            Reads serial barcodes, asset QR links and vendor QR codes (e.g. Dell service tags). If the
            unit is in New Stock or Refurbished you can <strong>Send to club</strong>: it stays in stock
            with a <strong>Reserved</strong> tag until it appears in a Zoho Assist import or link, then
            moves to Deployed and finance gets the dispatch notice. Unknown codes can be added as new
            hardware or attached to a unit that has no serial yet. On Android, use Chrome&apos;s{" "}
            <strong>Install app</strong> to put the scanner on the home screen.
          </>
        }
      />

      <CameraScanner active={state.phase === "scanning"} onDetected={(code) => void lookup(code)} />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(manual);
        }}
      >
        <input
          className="input-field px-3 py-2 text-sm min-w-0 flex-1"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type / use a handheld scanner"
          aria-label="Serial number or code"
          autoCapitalize="characters"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" className="btn-primary" disabled={!manual.trim() || state.phase === "looking"}>
          Look up
        </button>
      </form>

      {state.phase === "looking" ? (
        <p className="rounded-lg border border-line bg-white px-4 py-3 text-sm text-muted" role="status">
          Looking up <span className="font-mono text-ink">{state.code}</span>…
        </p>
      ) : null}

      {state.phase === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <p>{state.message}</p>
          <button type="button" className="btn-secondary mt-3" onClick={scanNext}>
            Scan again
          </button>
        </div>
      ) : null}

      {state.phase === "result" && state.data.asset ? (
        <FoundCard
          asset={state.data.asset}
          matchedBy={state.data.matchedBy}
          onReserve={setReserveAsset}
          onAssess={setAssessAsset}
          onScanNext={scanNext}
        />
      ) : null}

      {state.phase === "result" && !state.data.asset ? (
        <NotFoundCard
          code={state.data.parsed.serial ?? state.code}
          candidates={state.data.unitsWithoutSerial ?? []}
          onAttached={(name) => {
            toast.showSuccess(`Serial attached to ${name}.`);
            void lookup(state.code);
          }}
          onScanNext={scanNext}
        />
      ) : null}

      {reserveAsset ? (
        <ReservationDialog
          asset={reserveAsset}
          onClose={() => setReserveAsset(null)}
          onDone={(message) => {
            setReserveAsset(null);
            toast.showSuccess(message);
            if (currentCode) void lookup(currentCode);
          }}
        />
      ) : null}
      <StartAssessmentModal
        asset={assessAsset}
        onClose={() => setAssessAsset(null)}
        onSuccess={() => {
          setAssessAsset(null);
          if (currentCode) void lookup(currentCode);
        }}
      />
    </main>
  );
}

function FoundCard({
  asset,
  matchedBy,
  onReserve,
  onAssess,
  onScanNext,
}: {
  asset: BoardAsset;
  matchedBy: LookupResponse["matchedBy"];
  onReserve: (a: BoardAsset) => void;
  onAssess: (a: BoardAsset) => void;
  onScanNext: () => void;
}) {
  const model = displayAssetModel(asset);
  const reservation = isDepotStock(asset) ? asset.replacementReservation ?? null : null;

  return (
    <section className="rounded-lg border border-line bg-white p-4" aria-label="Scan result">
      <p className="text-xs font-medium text-hna-green-text">{matchedBy ? MATCH_LABEL[matchedBy] : "Found"}</p>
      <h2 className="mt-1 break-words text-lg font-semibold text-ink">{asset.assetName}</h2>
      {model ? <p className="text-sm text-muted">{model}</p> : null}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">Stage</dt>
        <dd className="flex items-center gap-1.5 text-ink">
          <span className={`h-2.5 w-2.5 rounded-full ${STAGE_DOT[asset.status.code] ?? "bg-neutral-400"}`} aria-hidden />
          {asset.status.label}
        </dd>
        <dt className="text-muted">Serial</dt>
        <dd className="break-all font-mono text-ink">{asset.serialNumber ?? "—"}</dd>
        <dt className="text-muted">Club</dt>
        <dd className="text-ink">{asset.club?.name ?? "No club"}</dd>
      </dl>

      {reservation ? (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>Reserved</strong> for {reservationLabel(reservation)}. It moves to Deployed when it appears in
          a Zoho Assist import or is linked.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isDepotStock(asset) ? (
          <button type="button" className="btn-primary" onClick={() => onReserve(asset)}>
            {reservation ? "Release reservation" : "Send to club"}
          </button>
        ) : null}
        {asset.status.code === "deployed" ? (
          <button type="button" className="btn-primary" onClick={() => onAssess(asset)}>
            Send for Assessment/Maintenance
          </button>
        ) : null}
        <Link href={`/assets?asset=${encodeURIComponent(asset.id)}`} className="btn-secondary">
          Open asset
        </Link>
        <button type="button" className="btn-secondary" onClick={onScanNext}>
          Scan next
        </button>
      </div>
    </section>
  );
}

function NotFoundCard({
  code,
  candidates,
  onAttached,
  onScanNext,
}: {
  code: string;
  candidates: SerialCandidate[];
  onAttached: (assetName: string) => void;
  onScanNext: () => void;
}) {
  const [attaching, setAttaching] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SerialCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      candidates.filter((c) =>
        !q
          ? true
          : [c.assetName, c.manufacturer, c.model, c.club?.name, c.status.label]
              .filter(Boolean)
              .some((v) => v!.toLowerCase().includes(q))
      ),
    [candidates, q]
  );

  async function attach() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${selected.id}/attach-serial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: code }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not attach serial");
      onAttached(selected.assetName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not attach serial");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-amber-300 bg-white p-4" aria-label="Not in the system">
      <p className="text-xs font-medium text-amber-800">Not in the system</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold text-ink">{code}</p>

      {!attaching ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => openAddHardware({ serialNumber: code })}>
            Add as new hardware
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setAttaching(true)}
            disabled={candidates.length === 0}
            title={candidates.length === 0 ? "Every unit already has a serial" : undefined}
          >
            Attach to a unit without serial ({candidates.length})
          </button>
          <button type="button" className="btn-secondary" onClick={onScanNext}>
            Scan next
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-ink">Pick the unit this serial belongs to. Only units with no real serial are listed.</p>
          <input
            className="input-field px-3 py-2 text-sm w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, model, club…"
            aria-label="Search units without serial"
          />
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line">
            {visible.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">No units match.</li>
            ) : (
              visible.map((c) => (
                <li key={c.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-brand-muted/50 ${
                      selected?.id === c.id ? "bg-brand-muted" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="attach-target"
                      className="mt-1"
                      checked={selected?.id === c.id}
                      onChange={() => setSelected(c)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{c.assetName}</span>
                      <span className="block text-xs text-muted">
                        {[c.manufacturer, c.model].filter(Boolean).join(" ") || "Unknown model"} · {c.status.label}
                        {c.club ? ` · ${c.club.name}` : ""}
                        {c.serialNumber ? ` · now "${c.serialNumber}"` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!selected || busy} onClick={() => void attach()}>
              {busy ? "Saving…" : selected ? `Attach to ${selected.assetName}` : "Attach serial"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setAttaching(false)} disabled={busy}>
              Back
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
