import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Preference keys the API accepts; values are validated by their consumers. */
export const ALLOWED_PREFERENCE_KEYS = new Set(["assets.columns"]);

export async function getUserPreference(userId: string, key: string): Promise<unknown> {
  const row = await prisma.userPreference
    .findUnique({ where: { userId_key: { userId, key } }, select: { value: true } })
    .catch((e) => {
      console.warn("user-preferences: read failed", e);
      return null;
    });
  return row?.value ?? null;
}

export async function setUserPreference(userId: string, key: string, value: unknown): Promise<void> {
  const json = value as Prisma.InputJsonValue;
  await prisma.userPreference.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value: json },
    update: { value: json },
  });
}
