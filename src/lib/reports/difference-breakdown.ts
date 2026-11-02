/**
 * Breaks the bridge's "difference to the register" into its parts, so no unexplained gap is shown.
 *
 * Register = Deployed + stock (new, refurbished, assessment, repair) + written off. The bridge is the prior count
 * after exclusions + the "Added since" lines + any "Written off" lines. So the difference is
 * (Deployed − added lines) + (stock − prior count left after exclusions) + (written off − written-off lines).
 * The middle term is itemised by model against the 31 Jan 2026 workbook.
 */

export type DifferenceReason =
  | "disposed_by_voucher"
  | "computer_not_captured"
  | "monitor_not_captured"
  | "reader_not_captured"
  | "stock_not_on_prior_count"
  | "written_off_after_capture"
  | "deployed_vs_line"
  | "written_off_lines"
  | "not_explained";

export type DifferencePart = {
  reason: DifferenceReason;
  label: string;
  quantity: number;
  /** e.g. "3 × Dell OptiPlex 3050 (to assess)". */
  items: string[];
  note: string;
  status: "explained" | "to_be_confirmed";
};

export type DifferenceBreakdown = {
  difference: number;
  parts: DifferencePart[];
  /** Prior-count items found in the register as stock, e.g. "11 × Posiflex PS-3316". */
  inRegister: string[];
  priorLeft: number;
};

type PriorLine = {
  label: string;
  match: RegExp;
  count: number;
  /** What a unit not found in the register stock counts as. */
  reason: Extract<DifferenceReason, "disposed_by_voucher" | "computer_not_captured" | "monitor_not_captured" | "reader_not_captured">;
};

/**
 * The 31 Jan 2026 workbook ("Potential Usable Total") after modems (57) and card-reader brackets (32): 43 items.
 * Lines for the same model are listed so that register stock is set against "not captured" before a voucher
 * disposal.
 */
export const PRIOR_COUNT_LEFT: PriorLine[] = [
  { label: "Posiflex PS-3316 (new)", match: /ps-?3316/i, count: 11, reason: "computer_not_captured" },
  { label: "Mecer X22S (to assess)", match: /x22s|mst6376/i, count: 1, reason: "computer_not_captured" },
  { label: "Dell OptiPlex 3050 (to assess)", match: /3050/, count: 3, reason: "computer_not_captured" },
  { label: "HP Compaq 8300 (repaired/used)", match: /8300/, count: 3, reason: "computer_not_captured" },
  { label: "Intel NUC7CJYH (used)", match: /nuc7c?jyh/i, count: 1, reason: "computer_not_captured" },
  { label: "Intel NUC7CJYH G6JY05100G51 (to assess)", match: /nuc7c?jyh/i, count: 1, reason: "disposed_by_voucher" },
  { label: "Dell OptiPlex 7440 GF01KF2 (to assess)", match: /7440/, count: 1, reason: "disposed_by_voucher" },
  { label: "Intel Compute Stick STK1AW32SC (new)", match: /stk1aw32sc/i, count: 1, reason: "computer_not_captured" },
  { label: "Mecer LE22BW monitor (to assess)", match: /le22bw/i, count: 1, reason: "monitor_not_captured" },
  { label: "Gigatek MSR250HK card reader", match: /msr250hk|msr205hk/i, count: 12, reason: "reader_not_captured" },
  { label: "Magtek 21040108 card reader", match: /magtek|21040108/i, count: 6, reason: "reader_not_captured" },
  { label: "Partner MSR213U card reader", match: /msr213u/i, count: 2, reason: "reader_not_captured" },
];

const PART_TEXT: Record<
  Exclude<DifferenceReason, "deployed_vs_line" | "written_off_lines" | "not_explained">,
  Pick<DifferencePart, "label" | "note" | "status">
> = {
  disposed_by_voucher: {
    label: "Disposed on 29 Jan 2026 by voucher, still on the 31 Jan 2026 workbook",
    note: "Disposal vouchers DIS4606261331 (Dell 7440 GF01KF2) and DIS4606254722 (NUC G6JY05100G51). The workbook was not updated.",
    status: "explained",
  },
  computer_not_captured: {
    label: "Computers on the 31 Jan 2026 count not captured into the register",
    note: "Taken over at the May 2026 hand-over, which Finance confirmed against the 31 Jan count, but not captured. Includes the two Dell 3050s returned faulty in January (GGFPDN2, 66S5NX2), which are not in the register. Some may since have been deployed and so are also in the Deployed line. To be located and captured, or written off.",
    status: "to_be_confirmed",
  },
  monitor_not_captured: {
    label: "Monitor on the 31 Jan 2026 count not captured into the register",
    note: "To be located and captured, or written off.",
    status: "to_be_confirmed",
  },
  reader_not_captured: {
    label: "Card readers on the 31 Jan 2026 count not captured into the register",
    note: "Only 7 Gigatek readers are in the register. To be located and captured, or written off.",
    status: "to_be_confirmed",
  },
  stock_not_on_prior_count: {
    label: "Register stock not on the 31 Jan 2026 count",
    note: "Stock in the register with no matching line on the prior count.",
    status: "to_be_confirmed",
  },
  written_off_after_capture: {
    label: "Written off after capture: in the register, but not in the prior count or the Deployed line",
    note: "Field units captured as Deployed and written off since, each with a disposal certificate unless listed as pending disposal.",
    status: "explained",
  },
};

export type StockAsset = { statusCode: string; family: string; text: string; label: string };

export function buildDifferenceBreakdown(input: {
  difference: number;
  /** Opening + "Not tracked by serial" lines. */
  priorLeft: number;
  /** Sum of the "Added since" lines. */
  addedLines: number;
  /** Sum of the "Written off" lines. */
  writtenOffLines: number;
  /** Every register asset that is not Deployed. */
  notDeployed: StockAsset[];
  /** All Deployed assets, hardware and readers. */
  deployed: number;
}): DifferenceBreakdown {
  const parts: DifferencePart[] = [];
  const add = (reason: DifferenceReason, quantity: number, items: string[], text: Pick<DifferencePart, "label" | "note" | "status">) => {
    if (quantity === 0) return;
    const existing = parts.find((p) => p.reason === reason);
    if (existing) {
      existing.quantity += quantity;
      existing.items.push(...items);
    } else parts.push({ reason, quantity, items, ...text });
  };

  const stock = input.notDeployed.filter((a) => a.statusCode !== "written_off");
  const writtenOff = input.notDeployed.filter((a) => a.statusCode === "written_off");
  const used = new Set<number>();
  const inRegister: string[] = [];
  for (const line of PRIOR_COUNT_LEFT) {
    let found = 0;
    stock.forEach((a, i) => {
      if (found < line.count && !used.has(i) && line.match.test(a.text)) {
        used.add(i);
        found += 1;
      }
    });
    if (found) inRegister.push(`${found} × ${line.label}`);
    const missing = line.count - found;
    if (missing) add(line.reason, -missing, [`${missing} × ${line.label}`], PART_TEXT[line.reason]);
  }
  const extra = stock.filter((_, i) => !used.has(i));
  add(
    "stock_not_on_prior_count",
    extra.length,
    extra.map((a) => `${a.label} (${a.family})`),
    PART_TEXT.stock_not_on_prior_count
  );
  add(
    "written_off_after_capture",
    writtenOff.length,
    writtenOff.map((a) => `${a.label} (${a.family})`),
    PART_TEXT.written_off_after_capture
  );
  add("deployed_vs_line", input.deployed - input.addedLines, [], {
    label: `Deployed now (${input.deployed}) against the "Added since" lines (${input.addedLines})`,
    note: "Units deployed or recalled since the Added since lines were last updated.",
    status: "to_be_confirmed",
  });
  add("written_off_lines", -input.writtenOffLines, [], {
    label: "Written-off lines in the bridge",
    note: "Written-off units are still in the register, so a written-off line is added back here.",
    status: "explained",
  });
  const priorTotal = PRIOR_COUNT_LEFT.reduce((s, l) => s + l.count, 0);
  const residual = input.difference - parts.reduce((s, p) => s + p.quantity, 0);
  add("not_explained", residual, [], {
    label: "Not yet explained",
    note:
      input.priorLeft !== priorTotal
        ? `The bridge's prior count after exclusions is ${input.priorLeft}, but the 31 Jan 2026 workbook leaves ${priorTotal}.`
        : "The parts above do not add up to the difference.",
    status: "to_be_confirmed",
  });
  return { difference: input.difference, parts, inRegister, priorLeft: input.priorLeft };
}
