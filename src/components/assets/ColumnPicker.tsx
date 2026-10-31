"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { ASSET_COLUMNS, type AssetColumnId } from "@/lib/inventory/asset-table";

type Props = {
  columns: AssetColumnId[];
  onChange: (next: AssetColumnId[]) => void;
  onReset: () => void;
};

/** Show/hide All assets columns. Choices are saved per user by the caller. */
export function ColumnPicker({ columns, onChange, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const toggle = (id: AssetColumnId) => {
    const next = columns.includes(id) ? columns.filter((c) => c !== id) : [...columns, id];
    if (next.length === 0) return;
    onChange(ASSET_COLUMNS.filter((c) => next.includes(c.id)).map((c) => c.id));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Columns3 className="h-4 w-4" aria-hidden />
        Columns
        <span className="text-xs text-muted tabular-nums">{columns.length}</span>
      </button>
      {open ? (
        <div
          className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-line bg-white p-2 shadow-lg"
          role="group"
          aria-label="Visible columns"
        >
          <ul className="max-h-80 overflow-y-auto">
            {ASSET_COLUMNS.map((c) => {
              const checked = columns.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-ink hover:bg-black/[0.04]">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={checked && columns.length === 1}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 accent-[var(--hna-green-strong)]"
                    />
                    {c.label}
                    {c.default ? <span className="ml-auto text-[11px] text-muted">default</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-line px-2 pt-2 text-xs text-muted">
            <span>Actions is always shown.</span>
            <button type="button" onClick={onReset} className="font-semibold text-brand-deep hover:underline">
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
