export type AuditorIndexEntry = {
  title: string;
  /** Reports tab that holds the document. */
  href: string;
  covers: string;
};

export type AuditorIndex = {
  title: string;
  /** "About older data": shown collapsed under the Notes for auditors and finance. */
  paragraphs: string[];
  /** Why the prior company's Service Desk Reports are supporting documents only. */
  serviceDeskDiscrepancies: string[];
  entries: AuditorIndexEntry[];
};

/**
 * Index for a chartered accountant. It names the documents and the dates.
 * It does not add the prior-company quantities to this system's register.
 */
export function buildAuditorIndex(): AuditorIndex {
  return {
    title: "Auditor index",
    paragraphs: [
      "Stock takes before this system are the prior-company (Albatros Solutions) workbooks for October, November and December 2025 and 31 January 2026. February to April 2026 carry the January count forward because Albatros held the stock and provided no counts or reporting. May 2026 is the hand-over, with no receiving count; Finance confirmed the stock against the 31 January 2026 count. June 2026 has no count on record.",
      "This system recorded its first asset on 18 April 2026 and was still loading the field fleet through 13 August 2026. The two series are joined by the hand-over and the reconciliation page. Their totals are not added together.",
      "July, August and September 2026 finance packs were emailed to finance and not kept. They cannot be rebuilt from the register as it stands now; an administrator can upload the emailed PDFs, which are marked as re-imported. The scheduled send used to skip October because it worked out the month from the 28th; it now closes the previous calendar month (SAST) on the 1st. The first pack this system keeps is October 2026.",
    ],
    serviceDeskDiscrepancies: [
      "The Service Desk Report \"Terminal Movement Totals\" show 11 for every model, every month (Posiflex 11/12/12). This contradicts the workbooks (e.g. December: Dell 7440 = 2, Intel NUC = 2).",
      "The December 2025 Master sheet shows different December figures again (opening NUC 2, 3050 0, 7440 1, Posiflex 12; 1 Posiflex sent; closing 11).",
      "The December report says \"No movements reported in December 2025\", but disposal certificate DIS4601364122 (Thabazimbi Mecer X22S) is dated 22 December 2025.",
      "The workbooks are the count of record. Service Desk Reports and the Master sheet are attached as supporting documents only.",
    ],
    entries: [
      {
        title: "History (before this system)",
        href: "?tab=history",
        covers:
          "Every month from October 2025: prior-company counts with their source workbooks and SHA-256 hashes, the January 2026 movements, the carried-forward months, the May 2026 hand-over record, and the emailed-not-stored months.",
      },
      {
        title: "Reconciliation: prior count to system register",
        href: "?tab=reconciliation",
        covers:
          "The bridge from the 31 January 2026 count (132) to the register (136), with excluded lines, additions and any difference shown as \"to be confirmed\".",
      },
      {
        title: "Monthly pack",
        href: "?tab=monthly",
        covers:
          "Stored official finance packs from October 2026: reconcile, breakdown, month-on-month, yearly, deployed field listing and CSV, each with a hash, recipients and send log.",
      },
      {
        title: "Year to date",
        href: "?tab=ytd",
        covers:
          "Stored finance months compared, and the yearly sheet. Hardware and USB HID Magnetic Stripe Readers add to the totals; other items are outside them.",
      },
    ],
  };
}
