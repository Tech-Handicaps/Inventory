"use client";

import {
  compositionHeadline,
  type LegacyColumnComposition,
} from "@/lib/reports/legacy-month-end";

export function StockCompositionBlock({
  title,
  note,
  columns,
}: {
  title: string;
  note?: string;
  columns: LegacyColumnComposition[];
}) {
  if (columns.length === 0) return null;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-xs font-bold text-muted">
          {title}
        </h3>
        {note ? <p className="mt-1 max-w-3xl text-sm text-muted">{note}</p> : null}
      </div>
      {columns.map((column) => (
        <div key={column.field} className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">
            {column.label} — {column.total}
          </h4>
          <p className="max-w-3xl text-sm text-ink">{compositionHeadline(column)}</p>
          <p className="text-sm text-muted">
            By section:{" "}
            {column.groupTotals
              .map((group) => `${group.groupLabel} ${group.quantity}`)
              .join(", ")}
            .
          </p>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Make / model</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {column.lines.map((line) => (
                  <tr
                    key={`${column.field}-${line.model}`}
                    className="border-b border-line"
                  >
                    <td className="px-4 py-3 text-ink">{line.groupLabel}</td>
                    <td className="px-4 py-3 font-medium">
                      {line.manufacturer} {line.model}
                    </td>
                    <td className="px-4 py-3 text-ink">{line.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-3 font-semibold" colSpan={3}>
                    Total {column.label.toLowerCase()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {column.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
