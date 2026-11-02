export type ReportDef = {
  id: string;
  title: string;
  /** One sentence: what the PDF is for. */
  description: string;
  audience: string;
  /** Shared PDF route type, or a dedicated route via `openPath`. */
  type?: string;
  openPath?: string;
};

export function reportHrefs(report: ReportDef) {
  const base = report.openPath ?? `/api/reports/pdf?type=${encodeURIComponent(report.type ?? "")}`;
  const join = base.includes("?") ? "&" : "?";
  return { open: base, download: `${base}${join}download=1` };
}

export function PdfButtons({ open, download, compact }: { open: string; download: string; compact?: boolean }) {
  const size = compact ? "py-2 text-xs" : "py-2.5";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={open} target="_blank" rel="noopener noreferrer" className={`btn-primary ${size}`}>
        Open PDF
      </a>
      <a href={download} className={`btn-secondary ${size}`}>
        Download
      </a>
    </div>
  );
}

export function ReportTile({ report }: { report: ReportDef }) {
  const hrefs = reportHrefs(report);
  return (
    <article className="section-card flex flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-heading text-sm font-bold text-ink">{report.title}</h3>
          <span className="funky-badge">PDF</span>
        </div>
        <p className="flex-1 text-sm leading-relaxed text-muted">{report.description}</p>
        <p className="text-xs font-medium text-muted">{report.audience}</p>
        <div className="mt-1 border-t border-line pt-4">
          <PdfButtons open={hrefs.open} download={hrefs.download} />
        </div>
      </div>
    </article>
  );
}

export function TabIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <header className="border-b border-line pb-4">
      <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">{children}</p>
    </header>
  );
}
