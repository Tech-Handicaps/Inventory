"use client";

import { ReportsLifecycleSlot } from "./reports-lifecycle-slot";
import { PageHeader } from "@/components/ui/PageHeader";

type ReportDef = {
  id: string;
  type: string;
  title: string;
  description: string;
  audience: string;
};

type ReportGroup = {
  id: string;
  label: string;
  blurb: string;
  reports: ReportDef[];
};

const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "snapshots",
    label: "Inventory snapshots",
    blurb: "Full or filtered PDFs of the live register for stakeholders and period-end review.",
    reports: [
      {
        id: "overall",
        type: "overall",
        title: "Overall inventory",
        description:
          "Counts by lifecycle stage plus every asset row — suited for auditors and accounting.",
        audience: "Stakeholders · Finance",
      },
      {
        id: "available",
        type: "available",
        title: "Available to distribute",
        description:
          "New Stock and Refurbished units ready to hand out, with the split in the summary.",
        audience: "Operations",
      },
      {
        id: "deployed",
        type: "deployed",
        title: "Deployed — field",
        description:
          "Assets currently deployed, with category breakdown and a full row listing.",
        audience: "Operations · Management",
      },
      {
        id: "refurbished",
        type: "refurbished",
        title: "Refurbished hardware",
        description:
          "Units in the Refurbished stage, ready for reuse or redistribution.",
        audience: "Operations",
      },
      {
        id: "terminals",
        type: "terminals_available",
        title: "Terminals available",
        description:
          "Available stock filtered to terminal, POS, or kiosk-class hardware by naming.",
        audience: "Operations",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    blurb: "Approved presets only — no physical assets or serial numbers.",
    reports: [
      {
        id: "catalog",
        type: "catalog",
        title: "Device template catalog",
        description:
          "Every Settings preset: label, make, model, category, notes, and template ID.",
        audience: "Audits · IT",
      },
    ],
  },
];

function pdfUrl(type: string) {
  return `/api/reports/pdf?type=${encodeURIComponent(type)}`;
}

function ReportTile({ report }: { report: ReportDef }) {
  const href = pdfUrl(report.type);
  return (
    <article className="section-card section-card-interactive group relative flex flex-col overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-brand to-brand-deep transition group-hover:from-brand-hover"
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-3 p-5 pl-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
            {report.title}
          </h3>
          <span className="funky-badge">PDF</span>
        </div>
        <p className="flex-1 text-sm leading-relaxed text-black/65">
          {report.description}
        </p>
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
          {report.audience}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 border-t border-black/5 pt-4">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1 py-2.5 sm:flex-none"
          >
            Open PDF
          </a>
          <a
            href={href}
            download
            className="btn-secondary flex-1 py-2.5 sm:flex-none"
          >
            Download
          </a>
        </div>
      </div>
    </article>
  );
}

export default function ReportsPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-10 p-6 pb-16">
        <PageHeader
          title="Reports"
          description="Printable inventory PDFs for sharing, audits, and accounting — plus a per-asset movement history from the board audit trail."
        >
          <nav className="flex flex-wrap gap-2" aria-label="Reports sections">
            <a href="#pdf-library" className="filter-pill filter-pill-active">
              PDF library
            </a>
            <a href="#lifecycle" className="filter-pill filter-pill-inactive">
              Asset lifecycle
            </a>
          </nav>
        </PageHeader>

        {/* PDF library */}
        <section id="pdf-library" className="scroll-mt-6 space-y-8">
          <header className="flex flex-col gap-2 border-b border-black/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold uppercase tracking-wide text-black">
                PDF library
              </h2>
              <p className="mt-1 max-w-xl text-sm text-black/60">
                Inventory PDFs include serials and dates where available. Open
                in a new tab or download for email and print.
              </p>
            </div>
            <p className="text-[11px] text-black/45 sm:text-right">
              Print via browser · Ctrl/Cmd+P after opening
            </p>
          </header>

          {REPORT_GROUPS.map((group) => (
            <div key={group.id} className="space-y-4">
              <div>
                <h3 className="font-heading text-xs font-bold uppercase tracking-[0.15em] text-black/50">
                  {group.label}
                </h3>
                <p className="mt-1 text-sm text-black/55">{group.blurb}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.reports.map((r) => (
                  <ReportTile key={r.id} report={r} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Lifecycle */}
        <ReportsLifecycleSlot />
      </main>
    
  );
}
