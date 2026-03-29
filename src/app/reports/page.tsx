"use client";

import { InventoryHeader } from "@/components/InventoryHeader";

const REPORTS: {
  id: string;
  type: string;
  title: string;
  description: string;
}[] = [
  {
    id: "overall",
    type: "overall",
    title: "Overall inventory",
    description:
      "Full snapshot: counts by lifecycle stage plus every asset row. Suited for stakeholders and period-end accounting review.",
  },
  {
    id: "in_stock",
    type: "in_stock",
    title: "Hardware in stock",
    description:
      "All items currently in the In stock stage — typically what is available for deployment or issue.",
  },
  {
    id: "refurbished",
    type: "refurbished",
    title: "Refurbished hardware",
    description:
      "Items in the Refurbished stage, ready for reuse or redistribution.",
  },
  {
    id: "terminals",
    type: "terminals_in_stock",
    title: "Terminals in stock",
    description:
      "Subset of In stock where the category or asset name suggests terminal, POS, or kiosk-class hardware. Adjust naming in inventory data to refine this list.",
  },
];

function pdfUrl(type: string) {
  return `/api/reports/pdf?type=${encodeURIComponent(type)}`;
}

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="reports" />

      <main className="mx-auto max-w-4xl space-y-8 p-6">
        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="font-heading text-xl font-bold uppercase tracking-wide text-black">
            PDF reports
          </h1>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-brand" />
          <p className="mt-4 text-sm leading-relaxed text-black/70">
            Generate printable PDFs for internal sharing, auditors, and
            accounting. Each report includes the Handicaps Network Africa header
            and a tabular listing with serial numbers and dates where available.
          </p>
        </div>

        <ul className="space-y-4">
          {REPORTS.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-black/10 bg-white p-6 shadow-sm"
            >
              <h2 className="font-heading text-base font-bold uppercase tracking-wide text-black">
                {r.title}
              </h2>
              <p className="mt-2 text-sm text-black/65">{r.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={pdfUrl(r.type)}
                  className="font-heading inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open PDF
                </a>
                <a
                  href={pdfUrl(r.type)}
                  className="font-heading inline-flex items-center justify-center rounded-lg border-2 border-black bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-black hover:text-white"
                  download
                >
                  Download
                </a>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-center text-xs text-black/45">
          Printing: use your browser’s print dialog after opening the PDF
          (Ctrl+P / Cmd+P). For email, attach the downloaded file.
        </p>
      </main>
    </div>
  );
}
