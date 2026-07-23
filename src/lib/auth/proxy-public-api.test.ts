import { describe, expect, it } from "vitest";
import { isPublicApiPath } from "@/lib/auth/public-api-paths";

describe("isPublicApiPath", () => {
  it("allows health, cron, and login", () => {
    expect(isPublicApiPath("/api/health")).toBe(true);
    expect(isPublicApiPath("/api/cron/sync-assist-public-ip")).toBe(true);
    expect(isPublicApiPath("/api/auth/login")).toBe(true);
  });

  it("requires session for other APIs", () => {
    expect(isPublicApiPath("/api/assets")).toBe(false);
    expect(isPublicApiPath("/api/me")).toBe(false);
    expect(isPublicApiPath("/api/admin/users")).toBe(false);
  });
});
