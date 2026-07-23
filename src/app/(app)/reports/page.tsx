"use client";

import { ReportsLifecycleSlot } from "./reports-lifecycle-slot";

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
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md">
      <div
        className="absolute inset-y-0 left-0 w-1 bg-brand/70 transition group-hover:bg-brand"
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-3 p-5 pl-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-black">
            {report.title}
          </h3>
          <span className="rounded-full bg-brand-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-hover">
            PDF
          </span>
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
            className="font-heading inline-flex flex-1 items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-hover sm:flex-none"
          >
            Open PDF
          </a>
          <a
            href={href}
            download
            className="font-heading inline-flex flex-1 items-center justify-center rounded-lg border border-black/20 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-black transition-colors hover:border-black hover:bg-black hover:text-white sm:flex-none"
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
        {/* Page intro */}
        <section className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-muted via-white to-surface p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-brand/5 blur-3xl"
            aria-hidden
          />
          <p className="font-heading text-[10px] font-bold uppercase tracking-[0.2em] text-brand-hover">
            Handicaps Network Africa
          </p>
          <h1 className="font-heading mt-2 text-2xl font-bold uppercase tracking-wide text-black sm:text-3xl">
            Reports
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/70 sm:text-base">
            Printable inventory PDFs for sharing, audits, and accounting — plus
            a per-asset movement history from the board audit trail.
          </p>
          <nav
            className="mt-6 flex flex-wrap gap-2"
            aria-label="Reports sections"
          >
            <a
              href="#pdf-library"
              className="font-heading rounded-full border border-brand/30 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-hover transition hover:border-brand hover:bg-white"
            >
              PDF library
            </a>
            <a
              href="#lifecycle"
              className="font-heading rounded-full border border-black/15 bg-white/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-black/70 transition hover:border-black/30 hover:bg-white"
            >
              Asset lifecycle
            </a>
          </nav>
        </section>

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
