import { describe, expect, it } from "vitest";
import { classifyReportAssetType } from "./asset-types";
import { buildStockReconcileReport } from "./stock-reconcile";

describe("classifyReportAssetType", () => {
  it("classifies USB HID magnetic stripe readers before hardware", () => {
    expect(classifyReportAssetType("USB HID Magnetic Stripe Reader")).toBe(
      "usb_hid_msr"
    );
    expect(classifyReportAssetType("Magnetic Stripe Reader")).toBe("usb_hid_msr");
  });

  it("classifies general hardware", () => {
    expect(classifyReportAssetType("Hardware")).toBe("hardware");
    expect(classifyReportAssetType("POS Terminal")).toBe("hardware");
  });

  it("classifies using any matching tag", () => {
    expect(
      classifyReportAssetType("Accessories", ["USB HID Magnetic Stripe Reader"])
    ).toBe("usb_hid_msr");
    expect(classifyReportAssetType("Hardware", ["POS Terminal", "Laptop"])).toBe(
      "hardware"
    );
  });
});

describe("buildStockReconcileReport", () => {
  it("separates stock counts by asset type", () => {
    const report = buildStockReconcileReport([
      {
        id: "1",
        category: "Hardware",
        status: { code: "new_stock", label: "New Stock" },
      },
      {
        id: "2",
        category: "Hardware",
        status: { code: "refurbished", label: "Refurbished" },
      },
      {
        id: "3",
        category: "USB HID Magnetic Stripe Reader",
        status: { code: "new_stock", label: "New Stock" },
      },
      {
        id: "4",
        category: "POS Terminal",
        status: { code: "deployed", label: "Deployed" },
      },
    ]);

    const hardware = report.stockRows.find((r) => r.assetTypeId === "hardware")!;
    const readers = report.stockRows.find((r) => r.assetTypeId === "usb_hid_msr")!;

    expect(hardware.newStock).toBe(1);
    expect(hardware.refurbished).toBe(1);
    expect(hardware.totalStock).toBe(2);
    expect(readers.newStock).toBe(1);
    expect(readers.totalStock).toBe(1);
    expect(report.stockGrandTotal.totalStock).toBe(3);
    expect(report.fullStatusRows.find((r) => r.assetTypeId === "hardware")!.deployed).toBe(1);
  });
});
