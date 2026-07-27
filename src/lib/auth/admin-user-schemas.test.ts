import { describe, expect, it } from "vitest";
import {
  createUserSchema,
  inviteUserSchema,
  loginBodySchema,
  patchUserSchema,
} from "@/lib/auth/admin-user-schemas";
import {
  isValidUsername,
  normalizeUsername,
  usernameSchema,
} from "@/lib/auth/username";

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

describe("createUserSchema", () => {
  it("accepts create payloads", () => {
    const parsed = createUserSchema.safeParse({
      username: "J_Smith",
      email: "j@example.com",
      password: "securepass1",
      role: "accountant",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.username).toBe("j_smith");
    }
  });

  it("rejects short passwords and bad usernames", () => {
    expect(
      createUserSchema.safeParse({
        username: "ab",
        email: "j@example.com",
        password: "short",
        role: "admin",
      }).success
    ).toBe(false);
  });
});

describe("patchUserSchema", () => {
  it("requires at least one field", () => {
    expect(patchUserSchema.safeParse({}).success).toBe(false);
    expect(patchUserSchema.safeParse({ role: "accountant" }).success).toBe(
      true
    );
    expect(patchUserSchema.safeParse({ disabled: true }).success).toBe(true);
    expect(
      patchUserSchema.safeParse({ username: "jsmith" }).success
    ).toBe(true);
    expect(
      patchUserSchema.safeParse({ email: "a@b.co" }).success
    ).toBe(true);
  });
});

describe("loginBodySchema", () => {
  it("requires identifier and password", () => {
    expect(loginBodySchema.safeParse({}).success).toBe(false);
    expect(
      loginBodySchema.safeParse({
        identifier: "jsmith",
        password: "x",
      }).success
    ).toBe(true);
  });
});

describe("username helpers", () => {
  it("normalizes and validates", () => {
    expect(normalizeUsername("  Foo.Bar ")).toBe("foo.bar");
    expect(isValidUsername("foo.bar")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a@b.com")).toBe(false);
    expect(usernameSchema.safeParse("OK_User-1").success).toBe(true);
  });
});
