"use client";

import { useEffect, useRef } from "react";
import {
  boardDropAction,
  boardMoveConsequences,
  hardwareBoardMoveError,
} from "@/lib/inventory/hardware-board-moves";
import {
  STAGE_DOT,
  assetMoveLabel,
  type BoardAsset,
  type BoardStatus,
} from "@/components/board/types";

const WORKFLOW_HINT: Record<string, string> = {
  assessment: "Opens the Assessment/Maintenance form",
  repair: "Opens the Log repair form",
  writeoff: "Opens the write-off form",
};

type Props = {
  asset: BoardAsset;
  /** Board stages in column order. */
  stages: BoardStatus[];
  /** Set when a card was dropped on a column; null shows the stage picker ("Move to…"). */
  target: BoardStatus | null;
  busy: boolean;
  onChoose: (target: BoardStatus) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmation for drag-moves, and the keyboard "Move to…" picker. */
export function MoveAssetDialog({ asset, stages, target, busy, onChoose, onCancel, onConfirm }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const from = asset.status;

  useEffect(() => {
    panelRef.current
      ?.querySelector<HTMLButtonElement>(target ? "[data-autofocus]" : "button:not(:disabled)")
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, busy, onCancel]);

  const consequences = target ? boardMoveConsequences(from.code, target.code) : [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal
      aria-labelledby="move-asset-title"
      aria-describedby="move-asset-body"
    >
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        aria-label="Cancel"
        onClick={busy ? undefined : onCancel}
      />
      <div ref={panelRef} className="relative w-full max-w-md rounded-lg border border-line bg-white p-5">
        {target ? (
          <>
            <h2 id="move-asset-title" className="text-base font-semibold text-ink">
              Move {assetMoveLabel(asset)} from {from.label} to {target.label}?
            </h2>
            <div id="move-asset-body" className="mt-3 space-y-2 text-sm text-ink">
              <p>
                <strong>{asset.assetName}</strong>
                {asset.club ? <span className="text-muted"> · {asset.club.name}</span> : null}
              </p>
              {consequences.map((c) => (
                <p key={c}>{c}</p>
              ))}
              <p className="text-xs text-muted">The move is recorded in the audit log with your name and the time.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                data-autofocus
                disabled={busy}
                onClick={onCancel}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="btn-primary"
              >
                {busy ? "Moving…" : `Move to ${target.label}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="move-asset-title" className="text-base font-semibold text-ink">
              Move {assetMoveLabel(asset)} to…
            </h2>
            <p id="move-asset-body" className="mt-1 text-sm text-muted">
              {asset.assetName} is in {from.label}.
            </p>
            <ul className="mt-4 space-y-1.5">
              {stages.map((st) => {
                const action = boardDropAction(from.code, st.code);
                const current = st.id === from.id;
                const blockedReason = hardwareBoardMoveError(from.code, st.code);
                const hint = current
                  ? "Current stage"
                  : action === null
                    ? blockedReason && !blockedReason.startsWith("Cannot move directly")
                      ? blockedReason
                      : `Not available from ${from.label}`
                    : WORKFLOW_HINT[action];
                return (
                  <li key={st.id}>
                    <button
                      type="button"
                      disabled={action === null}
                      onClick={() => onChoose(st)}
                      className="flex w-full items-start gap-2.5 rounded-md border border-line px-3 py-2 text-left hover:bg-brand-muted/50"
                    >
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STAGE_DOT[st.code] ?? "bg-neutral-400"}`}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{st.label}</span>
                        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
