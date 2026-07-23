import { z } from "zod";

/** Lowercase username: 3–32 chars, letters/digits/._- only (not an email). */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  const u = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(u)) return false;
  if (u.includes("@")) return false;
  return true;
}

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .transform((v) => v.toLowerCase())
  .refine((v) => USERNAME_PATTERN.test(v), {
    message:
      "Username may only use letters, numbers, dots, underscores, and hyphens",
  })
  .refine((v) => !v.includes("@"), {
    message: "Username cannot be an email address",
  });
