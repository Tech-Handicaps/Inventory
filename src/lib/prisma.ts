import { PrismaClient } from "@prisma/client";
import {
  normalizeDatabaseUrlForPrisma,
  warnIfLikelyMisconfiguredDatabaseUrl,
} from "@/lib/prisma-connection";

const databaseUrl = normalizeDatabaseUrlForPrisma(process.env.DATABASE_URL);
warnIfLikelyMisconfiguredDatabaseUrl(databaseUrl);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    ...(databaseUrl
      ? { datasources: { db: { url: databaseUrl } } }
      : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function runtimeFieldNames(
  client: PrismaClient,
  modelName: string
): string[] {
  try {
    const models = (
      client as unknown as {
        _runtimeDataModel?: {
          models?: Record<string, { fields?: Record<string, { name?: string }> }>;
        };
      }
    )._runtimeDataModel?.models;
    const model = models?.[modelName];
    if (!model?.fields) return [];
    return Object.values(model.fields)
      .map((f) => f.name)
      .filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

function prismaClientNeedsRefresh(client: PrismaClient): boolean {
  if (typeof (client as { userProfile?: unknown }).userProfile === "undefined") {
    return true;
  }
  const wocFields = runtimeFieldNames(client, "WriteOffCertificate");
  // Empty means we couldn't introspect — don't force recreate.
  if (wocFields.length === 0) return false;
  return (
    !wocFields.includes("xeroFixedAssetNumber") ||
    !wocFields.includes("replacementMakeModel") ||
    !wocFields.includes("replacementSerialNumber")
  );
}

/**
 * Single Prisma instance per serverless isolate (Vercel Lambda).
 * Caching on `globalThis` in production avoids connection churn and matches Prisma’s serverless guidance.
 *
 * If you see **PrismaClientInitializationError** or SQLSTATE **26000** / **42P05** (prepared statement
 * errors) on any query, fix `DATABASE_URL`: Supabase **transaction pooler** (port **6543**) must include
 * `?sslmode=require&pgbouncer=true&connection_limit=1` — see `.env.example`. `normalizeDatabaseUrlForPrisma`
 * appends `pgbouncer=true` when missing. Open `GET /api/health` for hints.
 */
function resolvePrisma(): PrismaClient {
  let client = globalForPrisma.prisma ?? createPrismaClient();

  // After `prisma generate`, a stale `next dev` singleton can omit new models/fields.
  if (process.env.NODE_ENV !== "production" && prismaClientNeedsRefresh(client)) {
    void client.$disconnect().catch(() => undefined);
    client = createPrismaClient();
  }

  globalForPrisma.prisma = client;
  return client;
}

export const prisma = resolvePrisma();
