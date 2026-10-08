export type AuditorIndexEntry = {
  title: string;
  /** In-page destination on Reports. The other reports stay behind this index. */
  href: string;
  covers: string;
};

export type AuditorIndex = {
  title: string;
  paragraphs: string[];
  entries: AuditorIndexEntry[];
};

/**
 * First page for a chartered accountant. It names the documents and the dates.
 * It does not add the prior-company quantities to this system's register.
 */
export function buildAuditorIndex(): AuditorIndex {
  return {
    title: "Auditor index",
    paragraphs: [
      "Read this page first. The other reports stay behind it.",
      "Stock takes before this system are the prior-company workbooks for October, November, and December 2025. January, February, and March 2026 are labelled copies of that December take. April 2026 is not a copy. This system recorded its first asset on 18 April 2026 and was still loading the field fleet through 13 August 2026. From the first finance month this system keeps, the monthly and yearly reports follow that register. The handover is the join between the two series. The totals are not added together.",
      "July, August, and September 2026 were emailed to finance and were not kept. They cannot be rebuilt from the register as it stands now. The scheduled send on 28 October 2026 prints September and skips, because September is already the last recorded send month. The first month this system keeps is the scheduled send that prints October 2026.",
    ],
    entries: [
      {
        title: "Prior-company months",
        href: "#prior-months",
        covers:
          "October 2025 through March 2026. October, November, and December come from the workbooks. January, February, and March repeat the December count and are labelled as copies. These forms count units by make and model. They do not list serial numbers.",
      },
      {
        title: "Prior-company month-on-month",
        href: "#month-on-month",
        covers:
          "The same prior-company months, compared with each other. The live register is not on this landscape.",
      },
      {
        title: "Stock report handover",
        href: "#handover",
        covers:
          "The join between the two series. A matching name is not a matching quantity. The totals are not added together.",
      },
      {
        title: "Official finance packs",
        href: "#finance-packs",
        covers:
          "Each kept month holds the reconcile, the breakdown, the finance month-on-month, the yearly sheet, and the deployed field listing taken at send time. A manual test is not kept, and a stored month is not replaced. The Deployed PDF in the library is today's register, not a stored month.",
      },
      {
        title: "Finance month-on-month",
        href: "#finance-month-on-month",
        covers:
          "Stored official packs only. Hardware, USB HID Magnetic Stripe Readers, and other stay in separate totals and are not added together.",
      },
      {
        title: "Finance yearly",
        href: "#finance-yearly",
        covers:
          "2025 is the December workbook, in its own block. 2026 is the latest stored finance month, in its own block. The blocks are not subtracted. 2026 is not closed until a December 2026 pack is stored.",
      },
    ],
  };
}
