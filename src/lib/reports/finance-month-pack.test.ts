import { describe, expect, it } from "vitest";
import {
  financeFieldListing,
  financePackSnapshot,
  financePackStoragePath,
  shouldKeepOfficialPack,
} from "@/lib/reports/finance-month-pack";
import type {
  AssetForReconcile,
  StockBreakdownReport,
  StockReconcileReport,
} from "@/lib/reports/stock-reconcile";

const reconcile = {
  fullStatusGrandTotal: {
    newStock: 17,
    refurbished: 2,
    totalStock: 19,
    deployed: 114,
    assessment: 0,
    repair: 0,
    writtenOff: 2,
    grandTotal: 135,
  },
  typeRows: [
    {
      assetTypeId: "hardware",
      assetTypeLabel: "Hardware",
      newStock: 10,
      refurbished: 2,
      totalStock: 12,
      deployed: 114,
      assessment: 0,
      repair: 0,
      writtenOff: 2,
      grandTotal: 128,
    },
    {
      assetTypeId: "usb_hid_msr",
      assetTypeLabel: "USB HID Magnetic Stripe Readers",
      newStock: 7,
      refurbished: 0,
      totalStock: 7,
      deployed: 0,
      assessment: 0,
      repair: 0,
      writtenOff: 0,
      grandTotal: 7,
    },
    {
      assetTypeId: "other",
      assetTypeLabel: "Other / uncategorized",
      newStock: 0,
      refurbished: 0,
      totalStock: 0,
      deployed: 0,
      assessment: 0,
      repair: 0,
      writtenOff: 0,
      grandTotal: 0,
    },
  ],
} as StockReconcileReport;

const breakdown: StockBreakdownReport = {
  sections: [
    {
      statusCode: "new_stock",
      statusLabel: "New Stock",
      totalCount: 17,
      models: [{ makeModel: "PosiFlex PS-3316", count: 11, assets: [] }],
    },
    {
      statusCode: "refurbished",
      statusLabel: "Refurbished",
      totalCount: 2,
      models: [],
    },
    {
      statusCode: "written_off",
      statusLabel: "Written Off",
      totalCount: 2,
      models: [{ makeModel: "Dell Inc. OptiPlex 3050 AIO", count: 1, assets: [] }],
    },
  ],
};

describe("official finance pack", () => {
  it("keeps a scheduled send that reached someone and is not already stored", () => {
    expect(
      shouldKeepOfficialPack({ mode: "cron", sent: 1, alreadyKept: false })
    ).toBe(true);
    expect(
      shouldKeepOfficialPack({ mode: "cron", sent: 0, alreadyKept: false })
    ).toBe(false);
    expect(
      shouldKeepOfficialPack({ mode: "manual_test", sent: 2, alreadyKept: false })
    ).toBe(false);
    expect(
      shouldKeepOfficialPack({ mode: "cron", sent: 1, alreadyKept: true })
    ).toBe(false);
  });

  it("freezes totals and make-and-model counts without serials", () => {
    const snapshot = financePackSnapshot(reconcile, breakdown);
    expect(snapshot.totals).toEqual({
      newStock: 17,
      refurbished: 2,
      usable: 19,
      deployed: 114,
      assessment: 0,
      inRepair: 0,
      writtenOff: 2,
      register: 135,
    });
    expect(snapshot.lines).toEqual([
      {
        statusCode: "new_stock",
        makeModel: "PosiFlex PS-3316",
        count: 11,
        sortOrder: 0,
      },
      {
        statusCode: "written_off",
        makeModel: "Dell Inc. OptiPlex 3050 AIO",
        count: 1,
        sortOrder: 1,
      },
    ]);
    expect(snapshot.typeTotals.map((row) => row.assetType)).toEqual([
      "hardware",
      "usb_hid_msr",
      "other",
    ]);
    expect(snapshot.typeTotals[0].register).toBe(128);
    expect(snapshot.typeTotals[1].usable).toBe(7);
    expect(snapshot.typeTotals[0].usable + snapshot.typeTotals[1].usable).toBe(
      snapshot.totals.usable
    );
    expect(JSON.stringify(snapshot)).not.toContain("serialNumber");
    expect(financePackStoragePath("2026-09", "reconcile")).toBe(
      "2026-09/hna-monthly-stock-reconcile.pdf"
    );
    expect(financePackStoragePath("2026-09", "month-on-month")).toBe(
      "2026-09/hna-finance-month-on-month.pdf"
    );
    expect(financePackStoragePath("2026-09", "yearly")).toBe(
      "2026-09/hna-finance-yearly.pdf"
    );
    expect(financePackStoragePath("2026-10", "field")).toBe(
      "2026-10/hna-finance-field-listing.pdf"
    );
    expect(snapshot.fieldUnits).toEqual([]);
  });

  it("freezes deployed serials by type and leaves every other status out", () => {
    const assets: AssetForReconcile[] = [
      {
        id: "1",
        assetName: "Reader",
        category: "USB HID Magnetic Stripe Reader",
        manufacturer: "Gigatek",
        model: "MSR250HK",
        serialNumber: "R-2",
        status: { code: "new_stock", label: "New stock" },
      },
      {
        id: "2",
        assetName: "Terminal B",
        category: "Hardware",
        manufacturer: "Dell",
        model: "OptiPlex 7440",
        serialNumber: "SN-B",
        status: { code: "deployed", label: "Deployed" },
      },
      {
        id: "3",
        assetName: "Terminal A",
        category: "Hardware",
        manufacturer: "Dell",
        model: "OptiPlex 3050",
        serialNumber: "SN-A",
        status: { code: "deployed", label: "Deployed" },
      },
      {
        id: "4",
        assetName: "Reader in the field",
        category: "USB HID Magnetic Stripe Reader",
        manufacturer: "Gigatek",
        model: "MSR250HK",
        serialNumber: "R-1",
        status: { code: "deployed", label: "Deployed" },
      },
    ];
    const units = financeFieldListing(assets);
    expect(units.map((unit) => unit.serialNumber)).toEqual(["SN-A", "SN-B", "R-1"]);
    expect(units.map((unit) => unit.assetType)).toEqual([
      "hardware",
      "hardware",
      "usb_hid_msr",
    ]);
    expect(units[0]).toMatchObject({
      manufacturer: "Dell",
      model: "OptiPlex 3050",
      serialNumber: "SN-A",
    });
    const snapshot = financePackSnapshot(reconcile, breakdown, assets);
    expect(snapshot.lines.some((line) => "serialNumber" in line)).toBe(false);
    expect(snapshot.fieldUnits).toHaveLength(3);
    expect(snapshot.totals.deployed).toBe(114);
  });
});
