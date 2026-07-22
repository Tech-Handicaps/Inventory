import { describe, expect, it } from "vitest";
import { appRoleForAuthUser } from "@/lib/auth/app-role-for-user";
import type { User } from "@supabase/supabase-js";

function fakeUser(
  overrides: Partial<User> & { email?: string; id?: string } = {}
): User {
  return {
    id: overrides.id ?? "user-1",
    email: overrides.email ?? "someone@example.com",
    app_metadata: overrides.app_metadata ?? {},
    user_metadata: overrides.user_metadata ?? {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

describe("appRoleForAuthUser", () => {
  it("denies users with no stored role (deny-by-default)", () => {
    expect(appRoleForAuthUser(fakeUser())).toBeNull();
  });

  it("does not elevate from user_metadata.role", () => {
    const user = fakeUser({
      user_metadata: { role: "admin" },
    });
    expect(appRoleForAuthUser(user)).toBeNull();
  });

  it("does not elevate from app_metadata.role alone", () => {
    const user = fakeUser({
      app_metadata: { role: "admin" },
    });
    expect(appRoleForAuthUser(user)).toBeNull();
  });

  it("uses stored UserRole when present", () => {
    expect(appRoleForAuthUser(fakeUser(), "operations")).toBe("operations");
    expect(appRoleForAuthUser(fakeUser(), "accountant")).toBe("accountant");
  });

  it("maps legacy stored roles", () => {
    expect(appRoleForAuthUser(fakeUser(), "management")).toBe("admin");
    expect(appRoleForAuthUser(fakeUser(), "accounts")).toBe("accountant");
  });
});
