"use client";

import { buildAuditorIndex } from "@/lib/reports/auditor-index";

const PDF_HREF = "/api/reports/auditor-index/pdf";

export function AuditorIndexSection() {
  const index = buildAuditorIndex();

  return (
    <section id="auditor-index" className="scroll-mt-6 space-y-4">
      <header className="border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-ink">
            Auditor index
          </h2>
          <div className="flex gap-2">
            <a
              href={PDF_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-2 text-xs"
            >
              Open PDF
            </a>
            <a href={`${PDF_HREF}?download=1`} className="btn-secondary py-2 text-xs">
              Download
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-ink">
        {index.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Open this</th>
              <th className="px-4 py-3 font-medium">What it covers</th>
            </tr>
          </thead>
          <tbody>
            {index.entries.map((entry) => (
              <tr key={entry.href} className="border-b border-line">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <a href={entry.href} className="text-brand-deep hover:underline">
                    {entry.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-ink">{entry.covers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
