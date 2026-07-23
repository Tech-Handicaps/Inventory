import { describe, expect, it } from "vitest";
import {
  inviteUserSchema,
  patchUserSchema,
} from "@/lib/auth/admin-user-schemas";

describe("inviteUserSchema", () => {
  it("accepts valid invite payloads", () => {
    const parsed = inviteUserSchema.safeParse({
      email: " Tech@Example.com ",
      role: "operations",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("tech@example.com");
      expect(parsed.data.role).toBe("operations");
    }
  });

  it("rejects invalid email or role", () => {
    expect(
      inviteUserSchema.safeParse({ email: "not-an-email", role: "admin" })
        .success
    ).toBe(false);
    expect(
      inviteUserSchema.safeParse({
        email: "a@b.co",
        role: "super_admin",
      }).success
    ).toBe(false);
  });
});

describe("patchUserSchema", () => {
  it("requires role and/or disabled", () => {
    expect(patchUserSchema.safeParse({}).success).toBe(false);
    expect(patchUserSchema.safeParse({ role: "accountant" }).success).toBe(
      true
    );
    expect(patchUserSchema.safeParse({ disabled: true }).success).toBe(true);
  });
});
