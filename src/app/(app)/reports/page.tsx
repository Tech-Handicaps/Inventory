"use client";

import { AuditorIndexSection } from "./auditor-index-section";
import { FinanceMonthOnMonthSection } from "./finance-month-on-month-section";
import { FinanceYearlySection } from "./finance-yearly-section";
import { FinancePacksSection } from "./finance-packs-section";
import { HandoverSection } from "./handover-section";
import { LegacyMonthEndSection } from "./legacy-month-end-section";
import { MonthOnMonthSection } from "./month-on-month-section";
import { ReportsLifecycleSlot } from "./reports-lifecycle-slot";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppRole } from "@/components/RoleProvider";

type ReportDef = {
  id: string;
  type: string;
  title: string;
  description: string;
  audience: string;
  /** When set, Open and Download use this path instead of the shared PDF route. */
  openPath?: string;
};

type ReportGroup = {
  id: string;
  label: string;
  blurb: string;
  reports: ReportDef[];
};

const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "finance",
    label: "Finance & reconciliation",
    blurb:
      "Monthly stock reconcile for accounting — asset types are kept separate so hardware and USB readers are never combined in one total.",
    reports: [
      {
        id: "reconcile",
        type: "reconcile",
        title: "Monthly stock reconcile",
        description:
          "Matrix by asset type: New stock, Refurbished, and Total stock, plus a full lifecycle breakdown for audit. Point-in-time snapshot for finance.",
        audience: "Finance · Accounting",
      },
      {
        id: "finance-month-on-month",
        type: "finance_month_on_month",
        title: "Finance month-on-month",
        description:
          "Stored official finance months only. The opening line points to the prior-company reports and the handover. Workbook columns are not on this landscape.",
        audience: "Auditors · Accounts",
        openPath: "/api/reports/finance-month-on-month/pdf",
      },
      {
        id: "finance-yearly",
        type: "finance_yearly",
        title: "Finance yearly",
        description:
          "2025 is the December workbook, split into terminals, monitors, PC sticks, modems, card readers, and accessories. 2026 uses hardware, USB card readers, and other. The blocks are not subtracted.",
        audience: "Auditors · Accounts",
        openPath: "/api/reports/finance-yearly/pdf",
      },
      {
        id: "month-on-month",
        type: "month_on_month",
        title: "Prior-company month-on-month",
        description:
          "October 2025 through March 2026, prior-company quantities only. The live register is not on this landscape.",
        audience: "Auditors · Accounts",
        openPath: "/api/reports/month-on-month/pdf",
      },
      {
        id: "handover",
        type: "handover",
        title: "Stock report handover",
        description:
          "Dates joining the two series, then each old line sorted as named on both sides, quantity only, or register only. The totals are not added.",
        audience: "Auditors · Accounts",
        openPath: "/api/reports/handover/pdf",
      },
    ],
  },
  {
    id: "stock-by-type",
    label: "Stock by asset type",
    blurb:
      "New Stock and Refurbished PDFs split by Hardware vs USB HID Magnetic Stripe Readers (classified from each asset’s category).",
    reports: [
      {
        id: "hardware-new",
        type: "hardware_new_stock",
        title: "Hardware — New stock",
        description:
          "Computers, terminals, POS, and general IT hardware in New Stock only.",
        audience: "Operations · Finance",
      },
      {
        id: "hardware-refurb",
        type: "hardware_refurbished",
        title: "Hardware — Refurbished",
        description:
          "General hardware in Refurbished stage, ready for redistribution.",
        audience: "Operations · Finance",
      },
      {
        id: "usb-new",
        type: "usb_hid_msr_new_stock",
        title: "USB HID readers — New stock",
        description:
          "USB HID Magnetic Stripe Readers in New Stock (category must include reader / MSR / magnetic stripe).",
        audience: "Operations · Finance",
      },
      {
        id: "usb-refurb",
        type: "usb_hid_msr_refurbished",
        title: "USB HID readers — Refurbished",
        description:
          "USB HID Magnetic Stripe Readers in Refurbished stage.",
        audience: "Operations · Finance",
      },
    ],
  },
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
          "Today's deployed units. A stored month's serials are on Official finance packs, taken at send time.",
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

function pdfUrl(type: string, download = false) {
  const base = `/api/reports/pdf?type=${encodeURIComponent(type)}`;
  return download ? `${base}&download=1` : base;
}

function ReportTile({ report }: { report: ReportDef }) {
  const openHref = report.openPath ?? pdfUrl(report.type);
  const downloadHref = report.openPath
    ? `${report.openPath}?download=1`
    : pdfUrl(report.type, true);
  return (
    <article className="section-card section-card-interactive group relative flex flex-col overflow-hidden">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-heading text-sm font-bold text-ink">
            {report.title}
          </h3>
          <span className="funky-badge">PDF</span>
        </div>
        <p className="flex-1 text-sm leading-relaxed text-muted">
          {report.description}
        </p>
        <p className="text-xs font-medium text-muted">
          {report.audience}
        </p>
        <div className="mt-1 flex flex-wrap gap-2 border-t border-line pt-4">
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex-1 py-2.5 sm:flex-none"
          >
            Open PDF
          </a>
          <a
            href={downloadHref}
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
  const { role } = useAppRole();
  const showFinancePacks = role !== "operations";
  return (
    <main className="mx-auto max-w-7xl space-y-10 p-6 pb-16">
        <PageHeader
          title="Reports"
          description="Printable PDFs for finance, audit and accounting."
          help="Finance reconciliation, stock by asset type, audit packs and per-asset movement history from the audit trail."
        >
          <nav className="flex flex-wrap gap-2" aria-label="Reports sections">
            <a href="#auditor-index" className="filter-pill filter-pill-active">
              Auditor index
            </a>
            <a href="#pdf-library" className="filter-pill filter-pill-inactive">
              PDF library
            </a>
            {showFinancePacks ? (
              <a href="#finance-packs" className="filter-pill filter-pill-inactive">
                Finance packs
              </a>
            ) : null}
            <a href="#finance-month-on-month" className="filter-pill filter-pill-inactive">
              Finance month on month
            </a>
            <a href="#finance-yearly" className="filter-pill filter-pill-inactive">
              Yearly
            </a>
            <a href="#month-on-month" className="filter-pill filter-pill-inactive">
              Prior month on month
            </a>
            <a href="#prior-months" className="filter-pill filter-pill-inactive">
              Prior months
            </a>
            <a href="#handover" className="filter-pill filter-pill-inactive">
              Handover
            </a>
            <a href="#lifecycle" className="filter-pill filter-pill-inactive">
              Asset lifecycle
            </a>
          </nav>
        </PageHeader>

        <AuditorIndexSection />

        {/* PDF library */}
        <section id="pdf-library" className="scroll-mt-6 space-y-8">
          <header className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-ink">
                PDF library
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted">
                Inventory PDFs include serials and dates where available. Use{" "}
                <strong>Monthly stock reconcile</strong> for finance; ensure each
                asset’s <strong>asset tags</strong> are set correctly (e.g. Hardware
                vs USB HID Magnetic Stripe Reader) so type splits are accurate.
              </p>
            </div>
            <p className="text-xs text-muted sm:text-right">
              Print via browser · Ctrl/Cmd+P after opening
            </p>
          </header>

          {REPORT_GROUPS.map((group) => (
            <div key={group.id} className="space-y-4">
              <div>
                <h3 className="font-heading text-xs font-bold text-muted">
                  {group.label}
                </h3>
                <p className="mt-1 text-sm text-muted">{group.blurb}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.reports.map((r) => (
                  <ReportTile key={r.id} report={r} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {showFinancePacks ? <FinancePacksSection /> : null}

        <FinanceMonthOnMonthSection />

        <FinanceYearlySection />

        <MonthOnMonthSection />

        <LegacyMonthEndSection />

        <HandoverSection />

        {/* Lifecycle */}
        <ReportsLifecycleSlot />
      </main>
    
  );
}
