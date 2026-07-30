import { describe, expect, it } from "vitest";
import { dedupeTags, resolveTagsForSave } from "./asset-tags";

describe("asset-tags", () => {
  it("dedupes case-insensitively", () => {
    expect(dedupeTags(["Hardware", "hardware", "POS"])).toEqual([
      "Hardware",
      "POS",
    ]);
  });

  it("resolves category from first tag", () => {
    expect(
      resolveTagsForSave({
        tags: ["USB HID Magnetic Stripe Reader", "Hardware"],
      })
    ).toEqual({
      tags: ["USB HID Magnetic Stripe Reader", "Hardware"],
      category: "USB HID Magnetic Stripe Reader",
    });
  });
});
