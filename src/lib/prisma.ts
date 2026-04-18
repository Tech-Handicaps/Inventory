import { PrismaClient } from "@prisma/client";
import { warnIfLikelyMisconfiguredDatabaseUrl } from "@/lib/prisma-connection";

warnIfLikelyMisconfiguredDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Single Prisma instance per serverless isolate (Vercel Lambda).
 * Caching on `globalThis` in production avoids connection churn and matches Prisma’s serverless guidance.
 *
 * If you see **PrismaClientInitializationError** on `userRole.findUnique` (or any query), the database
 * URL is wrong or unreachable: set `DATABASE_URL` to the Supabase **transaction pooler** URI with
 * `?sslmode=require&pgbouncer=true&connection_limit=1` — see `.env.example`. Open `GET /api/health` to
 * see the sanitized Prisma error message.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

globalForPrisma.prisma = prisma;
