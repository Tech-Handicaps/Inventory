"use client";

import { ReportTile, TabIntro, type ReportDef } from "./report-tile";

type Group = { id: string; label: string; reports: ReportDef[] };

const GROUPS: Group[] = [
  {
    id: "count",
    label: "Stock on hand today",
    reports: [
      {
        id: "overall",
        type: "overall",
        title: "Overall inventory",
        description: "Every asset on the register with its stage, serial and dates, for a full stock count.",
        audience: "Auditors · Finance",
      },
      {
        id: "available",
        type: "available",
        title: "Available to distribute",
        description: "New and refurbished units that can be handed out now.",
        audience: "Operations",
      },
      {
        id: "deployed",
        type: "deployed",
        title: "Deployed — field",
        description: "Units in the field today; a stored month's deployed serials are in its monthly pack.",
        audience: "Operations · Management",
      },
      {
        id: "refurbished",
        type: "refurbished",
        title: "Refurbished hardware",
        description: "Units in the Refurbished stage, ready for reuse.",
        audience: "Operations",
      },
      {
        id: "terminals",
        type: "terminals_available",
        title: "Terminals available",
        description: "Available terminal, POS and kiosk-class hardware.",
        audience: "Operations",
      },
    ],
  },
  {
    id: "by-type",
    label: "Stock by asset type",
    reports: [
      {
        id: "hardware-new",
        type: "hardware_new_stock",
        title: "Hardware — New stock",
        description: "Computers, terminals and POS hardware in New Stock.",
        audience: "Operations · Finance",
      },
      {
        id: "hardware-refurb",
        type: "hardware_refurbished",
        title: "Hardware — Refurbished",
        description: "General hardware in the Refurbished stage.",
        audience: "Operations · Finance",
      },
      {
        id: "usb-new",
        type: "usb_hid_msr_new_stock",
        title: "USB HID readers — New stock",
        description: "USB HID Magnetic Stripe Readers in New Stock.",
        audience: "Operations · Finance",
      },
      {
        id: "usb-refurb",
        type: "usb_hid_msr_refurbished",
        title: "USB HID readers — Refurbished",
        description: "USB HID Magnetic Stripe Readers in the Refurbished stage.",
        audience: "Operations · Finance",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    reports: [
      {
        id: "catalog",
        type: "catalog",
        title: "Device template catalog",
        description: "Every approved device preset, with no physical assets or serials.",
        audience: "Audits · IT",
      },
    ],
  },
];

export default function StockTab() {
  return (
    <section className="space-y-8">
      <TabIntro title="Stock count">
        Printable lists of the live register for a physical count; hardware and USB readers are always kept apart.
      </TabIntro>
      {GROUPS.map((group) => (
        <div key={group.id} className="space-y-4">
          <h3 className="font-heading text-xs font-bold text-muted">{group.label}</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.reports.map((report) => (
              <ReportTile key={report.id} report={report} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
