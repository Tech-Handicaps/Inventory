import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/auth/assignable-roles";
import { usernameSchema } from "@/lib/auth/username";

const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

/** Given / family name for the person who owns the login. */
export const personNamePartSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(60, "Name is too long")
  .regex(
    /^[\p{L}][\p{L}\p{M}'’\- ]{0,59}$/u,
    "Use letters, spaces, hyphens, or apostrophes only"
  );

export const inviteUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Valid email is required")
    .email("Valid email is required")
    .transform((v) => v.toLowerCase()),
  role: assignableRoleSchema,
});

export const createUserSchema = z.object({
  username: usernameSchema,
  email: z
    .string()
    .trim()
    .min(1, "Valid email is required")
    .email("Valid email is required")
    .transform((v) => v.toLowerCase()),
  firstName: personNamePartSchema,
  lastName: personNamePartSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  role: assignableRoleSchema,
});

export const patchUserSchema = z
  .object({
    role: assignableRoleSchema.optional(),
    disabled: z.boolean().optional(),
    username: usernameSchema.optional(),
    email: z
      .string()
      .trim()
      .min(1, "Valid email is required")
      .email("Valid email is required")
      .transform((v) => v.toLowerCase())
      .optional(),
    firstName: personNamePartSchema.optional(),
    lastName: personNamePartSchema.optional(),
  })
  .refine(
    (v) =>
      v.role !== undefined ||
      v.disabled !== undefined ||
      v.username !== undefined ||
      v.email !== undefined ||
      v.firstName !== undefined ||
      v.lastName !== undefined,
    { message: "Provide at least one field to update" }
  );

export const loginBodySchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Username or email is required")
    .max(254),
  password: z.string().min(1, "Password is required").max(128),
});

/** Display name for UI / email greetings. */
export function formatPersonDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string | null {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}
