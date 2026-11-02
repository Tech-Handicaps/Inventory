"use client";

import { useState } from "react";

/** Collapsed section whose content is only rendered (and so only fetched) once it is opened. */
export function LazyDetails({ summary, children }: { summary: React.ReactNode; children: () => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="rounded-lg border border-line bg-white p-4"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-ink">{summary}</summary>
      {open ? <div className="mt-4 space-y-6">{children()}</div> : null}
    </details>
  );
}
