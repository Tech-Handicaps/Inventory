import { describe, expect, it } from "vitest";
import {
  buildDepotAssetName,
  isAssistDeploymentUninstalled,
  isAssistDeviceNotFoundError,
  isDepotStockStatus,
  looksLikeHnaAssistDeploymentName,
  nextHnaStockAssetName,
  resolveReplacementAssetName,
  shouldClearAssistLink,
} from "@/lib/zoho/assist-lifecycle-shared";
import {
  hardwareBoardMoveError,
  isAllowedHardwareBoardMove,
} from "@/lib/inventory/hardware-board-moves";

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

describe("stock naming", () => {
  it("allocates sequential HNA-ST labels", () => {
    expect(nextHnaStockAssetName(["HNA-ST001", "HNA-ST004"])).toBe("HNA-ST005");
  });

  it("detects club deployment names", () => {
    expect(looksLikeHnaAssistDeploymentName("HNA-ATLANTIC-01")).toBe(true);
    expect(looksLikeHnaAssistDeploymentName("HNA-ST002")).toBe(false);
  });

  it("replaces Assist club names with stock labels", () => {
    expect(
      resolveReplacementAssetName(
        {
          assetName: "HNA-ATLANTIC-01",
          serialNumber: "DWXNDV2",
          manufacturer: "Dell Inc.",
          model: "OptiPlex 3050 AIO",
          status: { code: "refurbished" },
        },
        ["HNA-ST001"]
      )
    ).toBe("HNA-ST002");
  });
});

describe("shouldClearAssistLink", () => {
  it("clears when device is missing from Assist list", () => {
    expect(shouldClearAssistLink({ listRowRaw: null })).toBe(true);
  });

  it("clears when deployment status is uninstalled", () => {
    expect(
      shouldClearAssistLink({
        listRowRaw: {
          device_info: { deployment_status: "Uninstalled" },
        },
      })
    ).toBe(true);
  });

  it("keeps link when agent is installed", () => {
    expect(
      shouldClearAssistLink({
        listRowRaw: {
          device_info: { deployment_status: "Installed", status: "offline" },
        },
      })
    ).toBe(false);
  });
});

describe("isAssistDeploymentUninstalled", () => {
  it("matches common Assist deployment states", () => {
    expect(isAssistDeploymentUninstalled("Uninstalled")).toBe(true);
    expect(isAssistDeploymentUninstalled("Installed")).toBe(false);
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
