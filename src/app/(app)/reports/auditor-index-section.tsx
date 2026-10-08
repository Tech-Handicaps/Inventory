"use client";

import { buildAuditorIndex } from "@/lib/reports/auditor-index";

const PDF_HREF = "/api/reports/auditor-index/pdf";

export function AuditorIndexSection() {
  const index = buildAuditorIndex();

  return (
    <section id="auditor-index" className="scroll-mt-6 space-y-4">
      <header className="border-b border-black/10 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
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

      <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-black/70">
        {index.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10">
              <th className="px-4 py-3 font-medium">Open this</th>
              <th className="px-4 py-3 font-medium">What it covers</th>
            </tr>
          </thead>
          <tbody>
            {index.entries.map((entry) => (
              <tr key={entry.href} className="border-b border-black/5">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <a href={entry.href} className="text-brand hover:underline">
                    {entry.title}
                  </a>
                </td>
                <td className="px-4 py-3 text-black/70">{entry.covers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
