/**
 * Models on the prior-company month-end stock take (sheet "Actual").
 * Types were checked against public product listings; the stock-take name is kept
 * so a printed report still matches the workbook line for line.
 */

export type LegacySku = {
  key: string;
  groupLabel: string;
  manufacturer: string;
  model: string;
  category: string;
  tags: string[];
  /** Shown on the archived report and on the device template, when one is created. */
  typeNotes: string;
  /** Note printed on the stock-take form (same on every supplied month). */
  lineNotes?: string;
};

export const LEGACY_STOCK_SKUS: LegacySku[] = [
  {
    key: "mecer-x22s",
    groupLabel: "Terminals",
    manufacturer: "Mecer",
    model: "X22S",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal", "All-in-One"],
    typeNotes:
      "21.5-inch Mecer all-in-one PC (Xhibitor X22S family). Counted as a terminal on the stock take.",
  },
  {
    key: "mecer-x22s-t-plus",
    groupLabel: "Terminals",
    manufacturer: "Mecer",
    model: "X22S-T+",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal", "All-in-One"],
    typeNotes:
      "21.5-inch Mecer all-in-one with touch screen (X22S-T). Kept as its own line, separate from X22S.",
  },
  {
    key: "lenovo-m810z",
    groupLabel: "Terminals",
    manufacturer: "Lenovo",
    model: "M810z",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal", "All-in-One"],
    typeNotes:
      "Lenovo ThinkCentre M810z all-in-one desktop. Counted as a terminal on the stock take.",
  },
  {
    key: "dell-optiplex-3050",
    groupLabel: "Terminals",
    manufacturer: "Dell",
    model: "OptiPlex 3050",
    category: "Hardware",
    tags: ["Hardware", "Desktop", "Terminal"],
    typeNotes:
      "Dell OptiPlex 3050 business desktop. Counted as a terminal on the stock take.",
  },
  {
    key: "hp-compaq-8300",
    groupLabel: "Terminals",
    manufacturer: "HP",
    model: "Compaq 8300",
    category: "Hardware",
    tags: ["Hardware", "Desktop", "Terminal"],
    typeNotes:
      "HP Compaq Elite 8300 business desktop. Counted as a terminal on the stock take.",
    lineNotes: "1 Unit is in HNA Offices",
  },
  {
    key: "hp-eliteone-800",
    groupLabel: "Terminals",
    manufacturer: "HP",
    model: "EliteOne 800",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal", "All-in-One"],
    typeNotes:
      "HP EliteOne 800 all-in-one PC. Counted as a terminal on the stock take.",
  },
  {
    key: "dell-optiplex-5270",
    groupLabel: "Terminals",
    manufacturer: "Dell",
    model: "OptiPlex 5270",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal", "All-in-One"],
    typeNotes:
      "Dell OptiPlex 5270 all-in-one PC. Counted as a terminal on the stock take.",
  },
  {
    key: "dell-optiplex-7440",
    groupLabel: "Terminals",
    manufacturer: "Dell",
    model: "OptiPlex 7440",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal", "All-in-One"],
    typeNotes:
      "Dell OptiPlex 7440 all-in-one PC. Counted as a terminal on the stock take.",
  },
  {
    key: "dell-optiplex-7450",
    groupLabel: "Terminals",
    manufacturer: "Dell",
    model: "OptiPlex 7450",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal", "All-in-One"],
    typeNotes:
      "Dell OptiPlex 7450 all-in-one PC. Counted as a terminal on the stock take.",
  },
  {
    key: "posiflex-ps-3316e",
    groupLabel: "Terminals",
    manufacturer: "Posiflex",
    model: "PS-3316E",
    category: "Hardware",
    tags: ["Hardware", "POS Terminal"],
    typeNotes: "Posiflex PS-3316E fanless 15.6-inch POS terminal.",
  },
  {
    key: "asus-v229h",
    groupLabel: "Monitors",
    manufacturer: "Asus",
    model: "V229H",
    category: "Hardware",
    tags: ["Hardware", "Monitor"],
    typeNotes:
      "Stock-take name V229H is the ASUS VZ229H 21.5-inch monitor.",
  },
  {
    key: "mecer-le22bw",
    groupLabel: "Monitors",
    manufacturer: "Mecer",
    model: "LE22BW",
    category: "Hardware",
    tags: ["Hardware", "Monitor"],
    typeNotes: "Mecer LE22BW 22-inch computer monitor.",
  },
  {
    key: "intel-boxstk1aw32sc",
    groupLabel: "PC Sticks",
    manufacturer: "Intel",
    model: "BOXSTK1AW32SC",
    category: "Hardware",
    tags: ["Hardware", "Compute Stick"],
    typeNotes:
      "Intel Compute Stick STK1AW32SC (boxed SKU BOXSTK1AW32SC).",
  },
  {
    key: "intel-nuc7cjyh",
    groupLabel: "PC Sticks",
    manufacturer: "Intel",
    model: "NUC7CJYH",
    category: "Hardware",
    tags: ["Hardware", "Mini PC"],
    typeNotes:
      "Intel NUC kit NUC7CJYH, a 4×4-inch mini PC. Listed under PC Sticks on the stock take.",
  },
  {
    key: "huawei-e3131",
    groupLabel: "Modems",
    manufacturer: "Huawei",
    model: "E3131",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Huawei E3131 USB 3G modem.",
  },
  {
    key: "vodafone-k3565-rev-2",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "K3565-Rev 2",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Vodafone K3565 USB 3G modem.",
  },
  {
    key: "vodafone-k3565-z",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "K3565-Z",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Vodafone K3565-Z USB modem.",
  },
  {
    key: "vodafone-k3772-z",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "K3772-Z",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Vodafone K3772-Z USB modem.",
  },
  {
    key: "vodafone-k3772",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "K3772",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Vodafone K3772 USB modem.",
  },
  {
    key: "huawei-e153",
    groupLabel: "Modems",
    manufacturer: "Huawei",
    model: "E153",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Huawei E153 USB modem.",
  },
  {
    key: "vodafone-k3520",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "K3520",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Vodafone K3520 USB modem.",
  },
  {
    key: "vodafone-k4607-z",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "K4607-Z",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Vodafone K4607-Z LTE USB modem.",
  },
  {
    key: "huawei-e220",
    groupLabel: "Modems",
    manufacturer: "Huawei",
    model: "E220",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Huawei E220 USB modem.",
  },
  {
    key: "huawei-e160g",
    groupLabel: "Modems",
    manufacturer: "Huawei",
    model: "E160G",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "Huawei E160G USB modem.",
  },
  {
    key: "dlink-dwm-222",
    groupLabel: "Modems",
    manufacturer: "D-Link",
    model: "DWM-222",
    category: "USB Modem",
    tags: ["USB Modem"],
    typeNotes: "D-Link DWM-222 4G LTE USB adapter.",
  },
  {
    key: "dlink-dwr-932m",
    groupLabel: "Modems",
    manufacturer: "D-Link",
    model: "DWR-932M",
    category: "Mobile Router",
    tags: ["Mobile Router"],
    typeNotes:
      "D-Link DWR-932M 4G LTE mobile Wi-Fi router. Listed under Modems on the stock take.",
  },
  {
    key: "vodafone-r219h",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "R219h",
    category: "Mobile Router",
    tags: ["Mobile Router"],
    typeNotes:
      "Vodafone R219h 4G mobile Wi-Fi router. Listed under Modems on the stock take.",
  },
  {
    key: "vodafone-r219z",
    groupLabel: "Modems",
    manufacturer: "Vodafone",
    model: "R219z",
    category: "Mobile Router",
    tags: ["Mobile Router"],
    typeNotes:
      "Vodafone R219z 4G mobile Wi-Fi router. Listed under Modems on the stock take.",
  },
  {
    key: "magtek-21040108",
    groupLabel: "Card Readers",
    manufacturer: "MagTek",
    model: "21040108",
    category: "USB HID Magnetic Stripe Reader",
    tags: ["USB HID Magnetic Stripe Reader", "Magnetic Stripe Reader"],
    typeNotes:
      "MagTek 21040108 is a USB keyboard-emulation magnetic stripe reader (tracks 1–3). The vendor-defined HID part is 21040102. Counted with the other swipe readers for finance.",
    lineNotes: "To Dispose unit on HP terminal in AS Office",
  },
  {
    key: "gigatek-msr250hk",
    groupLabel: "Card Readers",
    manufacturer: "Gigatek",
    model: "MSR250HK",
    category: "USB HID Magnetic Stripe Reader",
    tags: ["USB HID Magnetic Stripe Reader", "Magnetic Stripe Reader"],
    typeNotes: "Gigatek MSR250-series USB magnetic stripe reader.",
  },
  {
    key: "partner-msr213u",
    groupLabel: "Card Readers",
    manufacturer: "Partner",
    model: "MSR213U",
    category: "USB HID Magnetic Stripe Reader",
    tags: ["USB HID Magnetic Stripe Reader", "Magnetic Stripe Reader"],
    typeNotes:
      "Partner Tech MSR213U USB magnetic stripe reader (HID and keyboard-emulation modes).",
  },
  {
    key: "mecer-card-reader-bracket",
    groupLabel: "Accessories",
    manufacturer: "Mecer",
    model: "Card Reader Bracket",
    category: "Accessory",
    tags: ["Accessory"],
    typeNotes: "Mounting bracket for a card reader. Not a reader.",
  },
  {
    key: "mecer-ust-tp01",
    groupLabel: "Accessories",
    manufacturer: "Mecer",
    model: "UST-TP01",
    category: "Accessory",
    tags: ["Accessory", "WiFi Dongle"],
    typeNotes: "Mecer UST-TP01 USB 802.11ac Wi-Fi nano dongle.",
    lineNotes:
      "Not counted. New, Repaired/Used, and To assess on the workbook are formulas pointing at the Posiflex PS-3316E row, so those cells repeat the Posiflex quantity. Stored as zero.",
  },
];
