import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/http/safe-redirect";

describe("safeRedirectPath", () => {
  it("allows relative app paths", () => {
    expect(safeRedirectPath("/inventory")).toBe("/inventory");
    expect(safeRedirectPath("/reports?x=1")).toBe("/reports?x=1");
    expect(safeRedirectPath("/assets#top")).toBe("/assets#top");
  });

  it("rejects open redirects", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/inventory");
    expect(safeRedirectPath("//evil.com")).toBe("/inventory");
    expect(safeRedirectPath("/\\evil.com")).toBe("/inventory");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/inventory");
  });

  it("uses fallback for empty/null", () => {
    expect(safeRedirectPath(null)).toBe("/inventory");
    expect(safeRedirectPath("")).toBe("/inventory");
    expect(safeRedirectPath("  ", "/dashboard")).toBe("/dashboard");
  });
});
