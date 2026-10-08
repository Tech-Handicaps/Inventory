import { describe, expect, it } from "vitest";
import {
  financePackSnapshot,
  financePackStoragePath,
  shouldKeepOfficialPack,
} from "@/lib/reports/finance-month-pack";
import type {
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
  });
});
