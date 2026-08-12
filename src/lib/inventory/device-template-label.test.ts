import { describe, expect, it } from "vitest";
import {
  buildDeviceTemplateLabel,
  displayDeviceTemplateLabel,
} from "@/lib/inventory/device-template-label";

describe("buildDeviceTemplateLabel", () => {
  it("joins manufacturer and model", () => {
    expect(
      buildDeviceTemplateLabel("Dell Inc.", "OptiPlex 7440 AIO")
    ).toBe("Dell Inc. OptiPlex 7440 AIO");
  });

  it("ignores empty parts", () => {
    expect(buildDeviceTemplateLabel("", "OptiPlex 7440 AIO")).toBe(
      "OptiPlex 7440 AIO"
    );
  });
});

describe("displayDeviceTemplateLabel", () => {
  it("prefers manufacturer + model over stale asset-style label", () => {
    expect(
      displayDeviceTemplateLabel({
        label: "HNA-CRADOCK-01",
        manufacturer: "Dell Inc.",
        model: "OptiPlex 7440 AIO",
      })
    ).toBe("Dell Inc. OptiPlex 7440 AIO");
  });
});
