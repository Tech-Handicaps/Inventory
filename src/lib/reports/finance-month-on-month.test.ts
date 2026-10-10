import { describe, expect, it } from "vitest";
import {
  FINANCE_MONTH_ON_MONTH_COLUMNS,
  buildFinanceMonthOnMonth,
  type FinanceMonthPosition,
} from "@/lib/reports/finance-month-on-month";

function position(
  monthKey: string,
  label: string,
  totals: Pick<
    FinanceMonthPosition,
    | "newStock"
    | "refurbished"
    | "usable"
    | "deployed"
    | "assessment"
    | "inRepair"
    | "writtenOff"
    | "register"
  >,
  lines: FinanceMonthPosition["lines"] = [],
  types: FinanceMonthPosition["types"] = []
): FinanceMonthPosition {
  return { monthKey, monthEndingLabel: label, ...totals, lines, types };
}

const october = position(
  "2026-10",
  "For month ending October 2026",
  {
    newStock: 17,
    refurbished: 2,
    usable: 19,
    deployed: 114,
    assessment: 0,
    inRepair: 0,
    writtenOff: 2,
    register: 135,
  },
  [{ statusCode: "new_stock", makeModel: "PosiFlex PS-3316", count: 10 }]
);

const december = position(
  "2026-12",
  "For month ending December 2026",
  {
    newStock: 15,
    refurbished: 2,
    usable: 17,
    deployed: 116,
    assessment: 0,
    inRepair: 0,
    writtenOff: 2,
    register: 135,
  },
  [
    { statusCode: "new_stock", makeModel: "PosiFlex PS-3316", count: 8 },
    { statusCode: "new_stock", makeModel: "Gigatek MSR250HK", count: 7 },
  ]
);

describe("finance month-on-month", () => {
  it("points at the prior-company reports and the handover, with no stored months yet", () => {
    const report = buildFinanceMonthOnMonth([]);
    expect(report.introduction[0]).toContain("prior-company month-on-month");
    expect(report.introduction[0]).toContain("handover");
    expect(report.months).toEqual([]);
    expect(report.movements).toEqual([]);
    expect(JSON.stringify(report)).not.toMatch(/Repaired\/Used|To assess|To dispose|Warranty/);
    expect(FINANCE_MONTH_ON_MONTH_COLUMNS.join(" ")).not.toMatch(
      /Repaired\/Used|To assess|To dispose|Warranty/
    );
  });

  it("leaves out a month that was never stored and compares the next stored position", () => {
    const report = buildFinanceMonthOnMonth([december, october]);
    expect(report.months.map((month) => month.monthKey)).toEqual([
      "2026-10",
      "2026-12",
    ]);
    expect(report.months[0].usableChange).toBeNull();
    expect(report.months[0].registerChange).toBeNull();
    expect(report.months[1].usableChange).toBe(-2);
    expect(report.months[1].registerChange).toBe(0);
    expect(report.introduction.join(" ")).not.toContain("2026-11");
    expect(report.introduction.join(" ")).toContain("outside that row");
    expect(report.movements).toEqual([
      {
        monthKey: "2026-12",
        monthEndingLabel: "For month ending December 2026",
        statusCode: "new_stock",
        statusLabel: "New stock",
        makeModel: "Gigatek MSR250HK",
        previous: 0,
        current: 7,
        delta: 7,
      },
      {
        monthKey: "2026-12",
        monthEndingLabel: "For month ending December 2026",
        statusCode: "new_stock",
        statusLabel: "New stock",
        makeModel: "PosiFlex PS-3316",
        previous: 10,
        current: 8,
        delta: -2,
      },
    ]);
  });

  it("keeps a USB reader change out of the hardware block", () => {
    const report = buildFinanceMonthOnMonth([
      position(
        "2026-10",
        "For month ending October 2026",
        {
          newStock: 17,
          refurbished: 2,
          usable: 19,
          deployed: 114,
          assessment: 0,
          inRepair: 0,
          writtenOff: 2,
          register: 135,
        },
        [],
        [
          {
            assetType: "hardware",
            label: "Hardware",
            newStock: 10,
            refurbished: 2,
            usable: 12,
            deployed: 114,
            assessment: 0,
            inRepair: 0,
            writtenOff: 2,
            register: 128,
          },
          {
            assetType: "usb_hid_msr",
            label: "USB HID Magnetic Stripe Readers",
            newStock: 7,
            refurbished: 0,
            usable: 7,
            deployed: 0,
            assessment: 0,
            inRepair: 0,
            writtenOff: 0,
            register: 7,
          },
        ]
      ),
      position(
        "2026-12",
        "For month ending December 2026",
        {
          newStock: 15,
          refurbished: 2,
          usable: 17,
          deployed: 116,
          assessment: 0,
          inRepair: 0,
          writtenOff: 2,
          register: 135,
        },
        [],
        [
          {
            assetType: "hardware",
            label: "Hardware",
            newStock: 8,
            refurbished: 2,
            usable: 10,
            deployed: 116,
            assessment: 0,
            inRepair: 0,
            writtenOff: 2,
            register: 128,
          },
          {
            assetType: "usb_hid_msr",
            label: "USB HID Magnetic Stripe Readers",
            newStock: 7,
            refurbished: 0,
            usable: 7,
            deployed: 0,
            assessment: 0,
            inRepair: 0,
            writtenOff: 0,
            register: 7,
          },
        ]
      ),
    ]);
    const hardware = report.typeBlocks.find((block) => block.assetType === "hardware");
    const readers = report.typeBlocks.find((block) => block.assetType === "usb_hid_msr");
    expect(hardware?.months[1].usableChange).toBe(-2);
    expect(readers?.months[1].usableChange).toBe(0);
    expect(readers?.months[1].register).toBe(7);
  });
});
