"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  /** e.g. "Delete asset?" */
  title: string;
  /** The item being deleted, shown in bold. */
  itemName: string;
  /** Serial or other identifier shown under the name. */
  itemDetail?: string | null;
  /** What happens after delete, one sentence. */
  consequence: string;
  busy?: boolean;
  confirmLabel?: string;
  busyLabel?: string;
  /** Red button for removals; brand green for non-destructive confirmations. */
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  title,
  itemName,
  itemDetail,
  consequence,
  busy,
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
  destructive = true,
  onCancel,
  onConfirm,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-body"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cancel"
        onClick={busy ? undefined : onCancel}
      />
      <div className="relative w-full max-w-md rounded-lg border border-[#e5e9ec] bg-white p-5">
        <h2 id="confirm-delete-title" className="text-base font-semibold text-ink">
          {title}
        </h2>
        <div id="confirm-delete-body" className="mt-3 space-y-2 text-sm text-ink">
          <p>
            <strong className="text-ink">{itemName}</strong>
            {itemDetail ? (
              <span className="mt-0.5 block font-mono text-xs text-muted">{itemDetail}</span>
            ) : null}
          </p>
          <p>{consequence}</p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-black/[0.04] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              destructive ? "bg-red-700 hover:bg-red-800" : "bg-brand hover:bg-brand-hover"
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
