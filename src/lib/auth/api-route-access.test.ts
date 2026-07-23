import { describe, expect, it } from "vitest";
import { apiAccessAllowedForRole } from "@/lib/auth/api-route-access";

describe("apiAccessAllowedForRole", () => {
  it("allows admin all routes", () => {
    expect(apiAccessAllowedForRole("/api/assets", "admin")).toBe(true);
    expect(apiAccessAllowedForRole("/api/admin/users", "admin")).toBe(true);
  });

  it("restricts reports_only to reports and me", () => {
    expect(apiAccessAllowedForRole("/api/me", "reports_only")).toBe(true);
    expect(apiAccessAllowedForRole("/api/reports/stock", "reports_only")).toBe(
      true
    );
    expect(apiAccessAllowedForRole("/api/assets", "reports_only")).toBe(false);
  });

  it("blocks operations from settings and admin", () => {
    expect(apiAccessAllowedForRole("/api/assets", "operations")).toBe(true);
    expect(apiAccessAllowedForRole("/api/admin/users", "operations")).toBe(
      false
    );
    expect(
      apiAccessAllowedForRole("/api/settings/zoho", "operations")
    ).toBe(false);
  });

  it("blocks accountant from zoho settings, audit, and admin", () => {
    expect(apiAccessAllowedForRole("/api/assets", "accountant")).toBe(true);
    expect(
      apiAccessAllowedForRole("/api/settings/zoho", "accountant")
    ).toBe(false);
    expect(apiAccessAllowedForRole("/api/audit-logs", "accountant")).toBe(
      false
    );
    expect(apiAccessAllowedForRole("/api/admin/users", "accountant")).toBe(
      false
    );
  });
});
