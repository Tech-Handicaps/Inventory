/**
 * Records from the prior company (Albatros Solutions) and the starting content for
 * Phase 5 tables. Written once by `scripts/import-phase5-prior-company.ts`; after that
 * administrators edit them in the app.
 */

export type PriorEventSeed = {
  eventDate: string;
  documentDate: string | null;
  eventType: "disposed" | "distributed" | "stolen" | "returned_faulty";
  description: string;
  assetLabel: string;
  serials: string[];
  fromLocation: string;
  toLocation: string;
  reference: string;
  crmReference: string | null;
  waybill: string | null;
  condition: string | null;
  evidenceFileName: string;
  notes: string | null;
};

export const JANUARY_2026_EVENTS: PriorEventSeed[] = [
  {
    eventDate: "2025-12-22",
    documentDate: null,
    eventType: "disposed",
    description: "Disposed (faulty, uneconomical to repair)",
    assetLabel: "Mecer X22S + Partner MSR213U card reader",
    serials: ["WA0292U160500189", "215160500127"],
    fromLocation: "76 Thabazimbi GC",
    toLocation: "975 Disposal",
    reference: "DIS4601364122",
    crmReference: "13320082",
    waybill: null,
    condition: null,
    evidenceFileName: "Thabazimbi Disposed Faulty X22S.pdf",
    notes: null,
  },
  {
    eventDate: "2026-01-07",
    documentDate: "2026-02-02",
    eventType: "distributed",
    description:
      "Distributed to club (replacement for the faulty X22S), New, plus 1 Mecer WiFi dongle",
    assetLabel: "Posiflex PS-3316",
    serials: ["PSN40589"],
    fromLocation: "1000 BROD/Warehouse",
    toLocation: "76 Thabazimbi GC",
    reference: "DIS4605548808",
    crmReference: "13320082",
    waybill: null,
    condition: "New",
    evidenceFileName: "Thabazimbi Replacement Posiflex.pdf",
    notes: null,
  },
  {
    eventDate: "2026-01-08",
    documentDate: null,
    eventType: "stolen",
    description: "Stolen",
    assetLabel: "Posiflex PS-3316",
    serials: ["PSM70594"],
    fromLocation: "221 Riverside GC",
    toLocation: "950 Stolen",
    reference: "DIS4603053200",
    crmReference: "13553806",
    waybill: null,
    condition: "Used: Good",
    evidenceFileName: "Riverside Stolen Posiflex.pdf",
    notes: null,
  },
  {
    eventDate: "2026-01-26",
    documentDate: null,
    eventType: "returned_faulty",
    description: "Returned faulty (hard drive), licence removed",
    assetLabel: "Dell OptiPlex 3050 + Gigatek MSR250HK",
    serials: ["GGFPDN2", "06202302585"],
    fromLocation: "283 Uitenhage GC",
    toLocation: "Warehouse – Repair",
    reference: "REC4604972969",
    crmReference: "13237709",
    waybill: "VLBWLJ",
    condition: "Used: Good",
    evidenceFileName: "Uitenhage Returned Faulty Dell 3050 .pdf",
    notes: null,
  },
  {
    eventDate: "2026-01-29",
    documentDate: null,
    eventType: "returned_faulty",
    description:
      "Returned faulty (hard drive), licence removed, club removed from GPRS billing",
    assetLabel: "Dell OptiPlex 3050 + Gigatek MSR250HK",
    serials: ["66S5NX2", "07182306103"],
    fromLocation: "251 Komga GC",
    toLocation: "Warehouse – Repair",
    reference: "REC4605171900",
    crmReference: "13532597",
    waybill: "DL8HSV",
    condition: "Used: Good",
    evidenceFileName: "Komga Retruned Faulty Dell 3050.pdf",
    notes: "The voucher says \"MSR205HK\", a typo for MSR250HK (confirmed by the owner).",
  },
  {
    eventDate: "2026-01-29",
    documentDate: "2026-02-09",
    eventType: "disposed",
    description: "Disposed (damaged chassis, faulty HDD)",
    assetLabel: "Dell OptiPlex 7440",
    serials: ["GF01KF2"],
    fromLocation: "1050 Warehouse – Repair",
    toLocation: "975 Disposal",
    reference: "DIS4606261331",
    crmReference: null,
    waybill: null,
    condition: null,
    evidenceFileName: "Disposed Dell7440_GF01KF2.pdf",
    notes: null,
  },
  {
    eventDate: "2026-01-29",
    documentDate: "2026-02-09",
    eventType: "disposed",
    description: "Disposed (faulty)",
    assetLabel: "Intel NUC7CJYH",
    serials: ["G6JY05100G51"],
    fromLocation: "1050 Warehouse – Repair",
    toLocation: "975 Disposal",
    reference: "DIS4606254722",
    crmReference: null,
    waybill: null,
    condition: null,
    evidenceFileName: "Disposed Nuc_G6JY05100G51.pdf",
    notes: "The voucher says \"NUC7JYH\", a typo for NUC7CJYH.",
  },
];

export type InconsistencySeed = {
  key: string;
  monthKey: string | null;
  title: string;
  detail: string;
};

export const PRIOR_COMPANY_INCONSISTENCIES: InconsistencySeed[] = [
  {
    key: "jan26-riverside-theft-not-in-movement-report",
    monthKey: "2026-01",
    title: "Riverside theft missing from the Movement Report",
    detail:
      "Posiflex PSM70594 is on voucher DIS4603053200 as stolen on 08 Jan 2026, but the January Movement Report's \"Stolen\" section says \"None\".",
  },
  {
    key: "jan26-nuc-disposed-still-counted",
    monthKey: "2026-01",
    title: "Disposed Intel NUC still counted in January",
    detail:
      "Intel NUC G6JY05100G51 was disposed on 29 Jan 2026 (DIS4606254722), yet the 31 Jan workbook still shows Intel NUC7CJYH To assess = 1 (unchanged from December).",
  },
  {
    key: "jan26-posiflex-new-vs-to-assess",
    monthKey: "2026-01",
    title: "Posiflex dispatched as New, but To assess dropped",
    detail:
      "Posiflex PSN40589 was dispatched as New on 07 Jan 2026, yet the January workbook's Posiflex New stays 11 and To assess drops 1 → 0.",
  },
  {
    key: "jan26-returned-readers-not-counted",
    monthKey: "2026-01",
    title: "Returned card readers not on the January workbook",
    detail:
      "The two Gigatek MSR250HK readers returned with the Uitenhage and Komga Dell 3050s (06202302585, 07182306103) are not reflected in the January workbook's card-reader lines (unchanged from December).",
  },
  {
    key: "dec25-thabazimbi-disposal-not-in-service-desk-report",
    monthKey: "2025-12",
    title: "Thabazimbi disposal missing from the December Service Desk Report",
    detail:
      "Disposal certificate DIS4601364122 (Thabazimbi Mecer X22S) is dated 22 Dec 2025, but the December Service Desk Report says \"No movements reported in December 2025\".",
  },
  {
    key: "jan26-documents-dated-after-events",
    monthKey: "2026-01",
    title: "Vouchers issued after the event dates",
    detail:
      "The January disposal certificates (DIS4606261331, DIS4606254722) were issued on 09 Feb 2026 and the Thabazimbi dispatch voucher (DIS4605548808) on 02 Feb 2026, after the event dates. Both dates are shown on each event.",
  },
  {
    key: "thabazimbi-x22s-serial-mismatch",
    monthKey: "2025-12",
    title: "Thabazimbi X22S serial differs from the register",
    detail:
      "Disposal certificate DIS4601364122 names Mecer X22S WA0292U160500189. The register's written-off Mecer X22S has serial WA0292U160500184, with this system's certificate HNA-WOF-2026-239DA9D3. Confirm whether these are the same unit before linking the prior-company certificate to it.",
  },
];

export const MODEL_ALIAS_SEED: {
  kind: "model" | "manufacturer";
  alias: string;
  canonical: string;
  notes: string;
}[] = [
  { kind: "model", alias: "PS-3316E", canonical: "PS-3316", notes: "Source files all say PS-3316E." },
  { kind: "model", alias: "NUC7JYH", canonical: "NUC7CJYH", notes: "Voucher typo." },
  { kind: "model", alias: "MSR205HK", canonical: "MSR250HK", notes: "Komga voucher typo, confirmed by the owner." },
  { kind: "model", alias: "3050", canonical: "OptiPlex 3050", notes: "\"Dell 3050\" on vouchers." },
  { kind: "model", alias: "Dell 3050", canonical: "OptiPlex 3050", notes: "\"Dell 3050\" / \"DELL 3050\" on vouchers." },
  { kind: "manufacturer", alias: "POSFILEX", canonical: "Posiflex", notes: "Voucher typo." },
  { kind: "manufacturer", alias: "Mustek", canonical: "Mecer", notes: "Mecer is the brand; Mustek is the manufacturing company." },
  { kind: "manufacturer", alias: "Mustek6376 MST6376", canonical: "Mecer", notes: "Mustek board string in the manufacturer field." },
];

export const RECONCILIATION_SEED: {
  section: "opening" | "excluded" | "added" | "written_off";
  label: string;
  quantity: number;
  status: "confirmed" | "to_be_confirmed";
  notes: string | null;
}[] = [
  {
    section: "opening",
    label: "31 Jan 2026 Albatros count (confirmed by Finance at the May 2026 hand-over)",
    quantity: 132,
    status: "confirmed",
    notes: "Quantity-only count. New 53, Repaired/Used 26, To assess 53.",
  },
  {
    section: "excluded",
    label: "Modems and routers – not tracked by serial",
    quantity: -57,
    status: "confirmed",
    notes: "Modems section of the 31 Jan 2026 workbook.",
  },
  {
    section: "excluded",
    label: "Mecer card-reader brackets – not tracked by serial",
    quantity: -32,
    status: "confirmed",
    notes: "Accessories section of the 31 Jan 2026 workbook.",
  },
  {
    section: "excluded",
    label: "Mecer UST-TP01 WiFi dongle line – memo only, not part of the 132",
    quantity: 0,
    status: "confirmed",
    notes: "Derived from the Posiflex line (11 in January). Dongles were written off in full and are not tracked.",
  },
  {
    section: "added",
    label: "Deployed units at clubs captured into the register (field capture in progress)",
    quantity: 115,
    status: "to_be_confirmed",
    notes: "Register count of Deployed. Some may be prior-count stock that was deployed after 31 Jan 2026.",
  },
];

export const HANDOVER_SEED = {
  monthKey: "2026-05",
  fromParty: "Albatros Solutions",
  basis:
    "Receiving count: none taken. Stock confirmed by Finance against the 31 Jan 2026 Albatros count.",
  notes:
    "Stock physically received from Albatros at HNA's offices. Date received, received by and any delivery reference are still to be filled in.",
};

export const AUDITOR_NOTES_KEY = "auditor-notes";

export const AUDITOR_NOTES_SEED = {
  title: "Notes for auditors and finance",
  markdown: `## What these reports cover

Two series of figures sit side by side. They are **not added together**.

1. **Prior-company counts (Albatros Solutions)** – quantity-only month-end stock takes for Oct, Nov and Dec 2025 and 31 Jan 2026. They count units by make and model and list no serial numbers.
2. **This system's register** – serialised assets, from the first asset recorded on 18 Apr 2026. Loading of the field fleet ran until 13 Aug 2026. Monthly finance packs are generated and stored automatically from October 2026.

## How each month is labelled

- **Oct–Dec 2025:** prior-company count, quantities only (no serials). Source workbook attached with its SHA-256 hash.
- **Jan 2026:** prior-company count, 31 Jan 2026, with 7 movement events from the January vouchers.
- **Feb–Apr 2026:** stock held by Albatros – no count or reporting provided – carried forward from the 31 Jan 2026 count. Not a month-end count.
- **May 2026:** stock received at HNA's offices (hand-over). No receiving count was taken; Finance confirmed the stock against the 31 Jan 2026 Albatros count.
- **Jun 2026:** no count on record – carried forward from 31 Jan 2026.
- **Jul–Sep 2026:** finance pack emailed, not stored. Re-uploaded copies are marked as re-imported.
- **Oct 2026 onward:** system month-end packs, stored with a hash, recipients and an audit trail.

## Categories

| Prior workbook | This system |
|---|---|
| New | New |
| Repaired/Used | Refurbished |
| To assess | Assessment/Maintenance |
| To dispose | Written off (only with a disposal certificate; otherwise "Pending disposal") |

## Points to note

- **Mecer** is the brand; **Mustek** is the manufacturing company. They are one OEM.
- The **Mecer UST-TP01 WiFi dongle** line is a memo line, excluded from totals. Its cells copy the Posiflex PS-3316E row. Dongles were written off in full and are not tracked.
- **Modems/routers (57)** and **Mecer card-reader brackets (32)** on the prior count are not tracked by serial. The reconciliation page bridges the 132 prior count to the 136-asset register and shows any difference as "to be confirmed".
- **Service Desk Reports** from the prior company are supporting documents only; their stock tables disagree with the workbooks, which are the count of record.
- All times are shown in **SAST (Africa/Johannesburg)**.

*Draft prepared from the reporting spec. Replace with the signed auditor note when it is supplied.*`,
};
