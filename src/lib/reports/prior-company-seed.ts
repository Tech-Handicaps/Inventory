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

/** Signed note "HNA-Notes-for-Auditors-and-Finance.pdf" (prepared 31 Oct 2026), transcribed. */
export const AUDITOR_NOTES_SEED = {
  title: "Notes for auditors and finance – inventory reporting Oct 2025 to Oct 2026",
  markdown: `*Handicaps Network Africa · Hardware Inventory · Prepared 31 Oct 2026*

Read this note before relying on any inventory report for Oct 2025 – Sep 2026. During this period the reporting moved from the prior company's quantity-only stock-take workbooks to a serial-number register in the new inventory system. The two series are not directly comparable. The notes below explain which figures can be relied on for each month.

## 1. Data sources by period

| Period | Status | What it means |
| --- | --- | --- |
| Oct – Dec 2025 | Prior-company count | Month-end stock-take workbooks from the prior service provider (Albatros Solutions): 130, 132 and 132 units. Quantities only, no serial numbers. All three source files are on record (Month End Stock Take 20251031 / 20251130 / 20251231.xlsx). |
| Jan 2026 | Prior-company count | A real January count exists (Month End Stock Take 20260131.xlsx), with a Terminal Movement Report and voucher PDFs. The total is 132 units, as in December, but the mix by model differs. It replaces the December copy previously shown for January. |
| Feb – Apr 2026 | Held by Albatros | From February 2026 the technical service moved from Albatros to HNA. Albatros kept holding the stock but provided no counts or reporting. Figures are carried forward from the 31 Jan 2026 count and must not be read as month-end counts. The new inventory system recorded its first asset on 18 Apr 2026; devices were loaded until 13 Aug 2026. |
| May 2026 | Hand-over | Stock physically received from Albatros at HNA's offices. No count was taken. Finance confirmed the actual stock against the last Albatros report (the 31 Jan 2026 count), which is the basis of the hand-over. |
| Jun 2026 | No count taken | No count was taken. Figures are carried forward from the 31 Jan 2026 count confirmed at hand-over and must not be read as a month-end count. |
| Jul – Sep 2026 | Packs not stored | Monthly finance packs were emailed but not kept in the system. Copies may be in the finance team's mailboxes; they will be re-imported where found. |
| Oct 2026 onward | System month-end | Generated from the serial register and stored in the system (see section 6). |

## 2. From 132 units to 136 assets

The December 2025 workbook counts 132 units by quantity. The system register holds 136 serialised assets. The totals differ because each source counts different things:

| Item | Count | Note |
| --- | --- | --- |
| Prior-company count, Dec 2025 | 132 | Quantity only, no serials |
| Included in it: modems and routers | ≈ 57 | Not tracked by serial in the new system |
| Included in it: Mecer card-reader brackets | 32 | Accessories, not tracked as assets |
| Not included: Mecer UST-TP01 WiFi dongles (memo) | 12 | Derived from the Posiflex line, not counted. Since written off in full and not tracked |
| System hardware assets | 129 | 10 new · 1 refurbished · 115 deployed · 3 written off |
| System USB card readers | 7 | Serialised |
| **System register total** | **136** | Individually serialised hardware |

Figures are not netted against each other here. A detailed line-by-line reconciliation, including additions, write-offs and any unexplained difference, will be added as a reconciliation page in the system.

## 3. January 2026 movements (backed by vouchers)

| Date | Event | Item · serial | Document |
| --- | --- | --- | --- |
| 22 Dec 2025 | Disposed (Thabazimbi) | Mecer X22S · WA0292U160500189 | DIS4601364122 |
| 07 Jan 2026 | Replacement sent (Thabazimbi) | Posiflex PS-3316E · PSN40589 | DIS4605548808 |
| 08 Jan 2026 | Stolen (Riverside) | Posiflex PS-3316E · PSM70594 | DIS4603053200 |
| 26 Jan 2026 | Returned faulty (Uitenhage) | Dell OptiPlex 3050 · GGFPDN2 | REC4604972969 |
| 29 Jan 2026 | Returned faulty (Komga) | Dell OptiPlex 3050 · 66S5NX2 | REC4605171900 |
| 29 Jan 2026 | Disposed | Dell OptiPlex 7440 · GF01KF2 | DIS4606261331 |
| 29 Jan 2026 | Disposed | Intel NUC7CJYH · G6JY05100G51 | DIS4606254722 |

## 4. Category mapping

| Prior workbook | Inventory system | Comment |
| --- | --- | --- |
| New | New | Unchanged |
| Repaired/Used | Refurbished | Same meaning |
| To assess | Assessment/Maintenance | Same meaning |
| To dispose | Written off (only with a disposal certificate) | Without a certificate, read as "pending disposal" |

## 5. Known data issues

- The Mecer UST-TP01 dongle line in the prior workbooks is a formula copying the Posiflex line (Oct 11, Nov 12, Dec 12, Jan 11), not a physical count. It is excluded from the unit totals. Dongles have since been written off in full and are no longer tracked.
- Model names differ between the series: PS-3316E vs PS-3316, and chipset names entered in the manufacturer field. Mecer is the brand; Mustek is the manufacturing company, not a separate OEM. Lenovo M810z and Lenovo 10Q0 are different models and are kept separate.
- The prior-company January records don't fully agree with each other. A theft is on a voucher but not in the movement report, the NUC disposal and the new Posiflex dispatch aren't reflected in the January workbook as expected, and the returned card readers aren't booked in. These are flagged for review, not corrected.
- The prior-company Service Desk Reports' stock tables (Oct–Dec 2025) don't match the workbooks, and the December report states "no movements" despite the 22 Dec disposal. The workbooks are treated as the count of record.
- Field capture in progress: the register tracks hardware deployed at clubs, but not all terminals have been captured yet. The Oct 2025 terminal export lists 354 terminals at clubs (305 HNA-owned), against 115 deployed in the register so far. Capture progress will be tracked on the reconciliation page.
- The 2025 and 2026 yearly blocks use different categories. The finance month-on-month and 2026 yearly blocks are currently empty.
- PDF generated times are inconsistent (e.g. 17:08 vs 19:08, a UTC/SAST mix-up). Read all times as SAST once corrected.
- Purchase and warranty dates are recorded for only 3 of 133 operational units (2.3%), so age and warranty statistics are indicative only.

## 6. Controls from October 2026

- Every monthly finance pack is generated automatically for the prior month, then stored in the system with a version, a timestamp and the recipient list. It is not just emailed.
- Generation, downloads, sends and re-imports are recorded in an audit trail.
- Old and new reports use one set of category and model names (mapping above).
- All timestamps are shown in SAST (Africa/Johannesburg).
- The system issues a disposal certificate for every disposal and emails it to finance and the owner. Earlier disposals (Dec 2025 – Jan 2026) are backed by the prior company's voucher PDFs.
- Any report covering a period before Oct 2026 carries this note as its first page.

Contact: Shafiek Christian · shafiek@handicaps.co.za`,
};
