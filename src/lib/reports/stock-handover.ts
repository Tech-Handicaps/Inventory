export type HandoverSeries = "Prior company" | "This system";

export type HandoverEvent = {
  dateLabel: string;
  series: HandoverSeries;
  statement: string;
};

export type HandoverOutcomeLine = {
  name: string;
  /** Workbook catalog keys covered by this line. Empty for register-only rows. */
  skuKeys: string[];
  note: string;
};

export type HandoverOutcome = {
  id: "named_on_both_sides" | "quantity_only" | "register_only";
  title: string;
  statement: string;
  lines: HandoverOutcomeLine[];
};

export type StockHandover = {
  title: string;
  paragraphs: string[];
  events: HandoverEvent[];
  outcomes: HandoverOutcome[];
};

/**
 * Dates locked for the handover between the prior-company stock takes and
 * this system's register. Quantities stay on their own reports.
 */
export function buildStockHandover(): StockHandover {
  return {
    title: "Stock report handover",
    paragraphs: [
      "This page is the join between the prior-company stock takes and this system's register. Both series are named here. Their totals are not added together.",
      "The prior-company series of stock takes ends on 31 December 2025. January, February, and March 2026 repeat that December take. They are copies, kept so accounts has a file for each of those months. April 2026 is not a copy of December.",
      "This system recorded its first asset on 18 April 2026. The field fleet was still being loaded through 13 August 2026. Months in that window are capture in progress, not a closed month-end position, until a finance pack is kept.",
    ],
    events: [
      {
        dateLabel: "31 October 2025",
        series: "Prior company",
        statement:
          "Workbook stock take. Quantity counts by make and model, with no serial numbers.",
      },
      {
        dateLabel: "30 November 2025",
        series: "Prior company",
        statement:
          "Workbook stock take. Quantity counts by make and model, with no serial numbers.",
      },
      {
        dateLabel: "31 December 2025",
        series: "Prior company",
        statement:
          "Last prior-company stock take. The series of real takes ends on this date.",
      },
      {
        dateLabel: "31 January 2026",
        series: "Prior company",
        statement:
          "Copy of the 31 December 2025 take. No new workbook was supplied for this month.",
      },
      {
        dateLabel: "28 February 2026",
        series: "Prior company",
        statement:
          "Copy of the 31 December 2025 take. No new workbook was supplied for this month.",
      },
      {
        dateLabel: "31 March 2026",
        series: "Prior company",
        statement:
          "Copy of the 31 December 2025 take. The labelled copies stop here.",
      },
      {
        dateLabel: "18 April 2026",
        series: "This system",
        statement:
          "First asset recorded in this system. April is not a copy of the December stock take.",
      },
      {
        dateLabel: "13 August 2026",
        series: "This system",
        statement:
          "The field fleet was still being loaded through this date.",
      },
    ],
    outcomes: [
      {
        id: "named_on_both_sides",
        title: "Named on both sides",
        statement:
          "These names are on the prior-company stock take and on this system's register. A matching name is not a matching quantity. From here they are counted only as serialised assets.",
        lines: [
          {
            name: "Posiflex PS-3316E",
            skuKeys: ["posiflex-ps-3316e"],
            note: "The register calls this PosiFlex PS-3316.",
          },
          {
            name: "Dell OptiPlex 3050, 5270, 7440, and 7450",
            skuKeys: [
              "dell-optiplex-3050",
              "dell-optiplex-5270",
              "dell-optiplex-7440",
              "dell-optiplex-7450",
            ],
            note: "The register calls these Dell Inc. OptiPlex all-in-ones.",
          },
          {
            name: "HP Compaq 8300",
            skuKeys: ["hp-compaq-8300"],
            note: "The register calls this the HP Compaq Elite 8300.",
          },
          {
            name: "Mecer X22S and X22S-T+",
            skuKeys: ["mecer-x22s", "mecer-x22s-t-plus"],
            note: "The register records these as Mustek or MECER X22S and X22S-T. Some Zoho Assist rows store the chipset string Mustek6376 MST6376 as the manufacturer.",
          },
          {
            name: "Lenovo M810z",
            skuKeys: ["lenovo-m810z"],
            note: "The register stores Lenovo machine type 10Q0. Lenovo's parts list identifies type 10Q0 as the ThinkCentre M810z.",
          },
          {
            name: "Intel NUC7CJYH",
            skuKeys: ["intel-nuc7cjyh"],
            note: "The register uses the same model name.",
          },
          {
            name: "Gigatek MSR250HK",
            skuKeys: ["gigatek-msr250hk"],
            note: "The register uses the same model name. These serials were entered in this system. They did not arrive in the Zoho Assist field import.",
          },
        ],
      },
      {
        id: "quantity_only",
        title: "Quantity only",
        statement:
          "These lines stay on the prior-company reports. They were never given serial numbers, so they do not appear as assets in this system.",
        lines: [
          {
            name: "Mecer Card Reader Bracket",
            skuKeys: ["mecer-card-reader-bracket"],
            note: "A mounting bracket, not a reader.",
          },
          {
            name: "Mecer UST-TP01",
            skuKeys: ["mecer-ust-tp01"],
            note: "Wi-Fi dongle. Kept on the form and counted as zero, because the workbook cells copy the Posiflex PS-3316E row.",
          },
          {
            name: "USB modems",
            skuKeys: [
              "huawei-e3131",
              "vodafone-k3565-rev-2",
              "vodafone-k3565-z",
              "vodafone-k3772-z",
              "vodafone-k3772",
              "huawei-e153",
              "vodafone-k3520",
              "vodafone-k4607-z",
              "huawei-e220",
              "huawei-e160g",
              "dlink-dwm-222",
            ],
            note: "Huawei E3131, E153, E220, and E160G. Vodafone K3565-Rev 2, K3565-Z, K3772, K3772-Z, K3520, and K4607-Z. D-Link DWM-222.",
          },
          {
            name: "Mobile routers",
            skuKeys: ["dlink-dwr-932m", "vodafone-r219h", "vodafone-r219z"],
            note: "D-Link DWR-932M. Vodafone R219h and R219z. Listed under Modems on the stock take.",
          },
          {
            name: "MagTek 21040108 and Partner MSR213U",
            skuKeys: ["magtek-21040108", "partner-msr213u"],
            note: "Swipe readers on the stock take. No serial was created for either model.",
          },
          {
            name: "HP EliteOne 800, Asus V229H, Mecer LE22BW, and Intel BOXSTK1AW32SC",
            skuKeys: [
              "hp-eliteone-800",
              "asus-v229h",
              "mecer-le22bw",
              "intel-boxstk1aw32sc",
            ],
            note: "On the workbook, and not present as a serial in this system.",
          },
        ],
      },
      {
        id: "register_only",
        title: "Register only",
        statement:
          "Zoho Assist field units start in this system. Where the make matches a name above, that serial is the register side of that name, not a second stock take. Two Assist rows are not on the workbook at all.",
        lines: [
          {
            name: "HNA-BETHLEHM-01",
            skuKeys: [],
            note: "Zoho Assist recorded the manufacturer as MICRO-STAR INTERNATIONAL CO., LTD and the model as MS-A95311. There is no workbook line for it.",
          },
          {
            name: "HNA-KRPRKGC-01",
            skuKeys: [],
            note: "Zoho Assist field unit with no make or model recorded.",
          },
        ],
      },
    ],
  };
}
