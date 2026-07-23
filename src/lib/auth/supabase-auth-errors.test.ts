import { describe, expect, it } from "vitest";
import { isSupabaseAuthSessionMissingError } from "@/lib/auth/supabase-auth-errors";

describe("isSupabaseAuthSessionMissingError", () => {
  it("treats AuthSessionMissingError as logged out", () => {
    expect(
      isSupabaseAuthSessionMissingError({
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
      })
    ).toBe(true);
  });

  it("treats message-only session missing as logged out", () => {
    expect(
      isSupabaseAuthSessionMissingError({ message: "Auth session missing!" })
    ).toBe(true);
  });

  it("does not treat other auth errors as session missing", () => {
    expect(
      isSupabaseAuthSessionMissingError({
        name: "AuthApiError",
        message: "Invalid JWT",
      })
    ).toBe(false);
  });
});
