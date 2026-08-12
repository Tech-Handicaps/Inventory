import { describe, expect, it } from "vitest";
import {
  buildDepotAssetName,
  hardwareBoardMoveError,
  isAllowedHardwareBoardMove,
  isAssistDeviceNotFoundError,
  isDepotStockStatus,
} from "@/lib/zoho/assist-lifecycle";

describe("isAssistDeviceNotFoundError", () => {
  it("detects Assist 404 messages", () => {
    expect(isAssistDeviceNotFoundError(new Error("Assist API 404: not found"))).toBe(
      true
    );
    expect(isAssistDeviceNotFoundError(new Error("Sync failed"))).toBe(false);
  });
});

describe("buildDepotAssetName", () => {
  it("uses template label and serial", () => {
    expect(
      buildDepotAssetName({
        serialNumber: "ABC123",
        manufacturer: "Posiflex",
        model: "XT4015",
        deviceTemplate: { label: "POS Terminal" },
      })
    ).toBe("POS Terminal · S/N ABC123");
  });
});

describe("hardware board moves", () => {
  it("blocks deployed → refurbished", () => {
    expect(isAllowedHardwareBoardMove("deployed", "refurbished")).toBe(false);
    expect(hardwareBoardMoveError("deployed", "refurbished")).toMatch(
      /Assessment\/Maintenance/
    );
  });

  it("allows assessment → refurbished", () => {
    expect(isAllowedHardwareBoardMove("assessment", "refurbished")).toBe(true);
  });

  it("allows assessment → deployed (return to club)", () => {
    expect(isAllowedHardwareBoardMove("assessment", "deployed")).toBe(true);
  });
});

describe("isDepotStockStatus", () => {
  it("includes refurbished and new_stock", () => {
    expect(isDepotStockStatus("refurbished")).toBe(true);
    expect(isDepotStockStatus("deployed")).toBe(false);
  });
});
