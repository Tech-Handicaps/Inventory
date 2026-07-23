import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/auth/assignable-roles";

const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES);

export const inviteUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Valid email is required")
    .email("Valid email is required")
    .transform((v) => v.toLowerCase()),
  role: assignableRoleSchema,
});

export const patchUserSchema = z
  .object({
    role: assignableRoleSchema.optional(),
    disabled: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.disabled !== undefined, {
    message: "Provide role and/or disabled flag",
  });
