import { Prisma } from "@prisma/client";

/**
 * Maps Prisma errors to HTTP status + JSON body for API routes.
 */
export function prismaMutationError(
  error: unknown,
  fallbackMessage: string
): { status: number; body: Record<string, string> } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        status: 409,
        body: {
          error: "A record with this unique value already exists",
          prismaCode: error.code,
        },
      };
    }
    if (error.code === "P2021") {
      return {
        status: 500,
        body: {
          error:
            "Database schema is missing a table or column. Deploy migrations (e.g. prisma migrate deploy).",
          prismaCode: error.code,
        },
      };
    }
    return {
      status: 500,
      body: {
        error: `Database error (${error.code})`,
        prismaCode: error.code,
      },
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      body: {
        error: "Database connection failed. Check DATABASE_URL and network access.",
        code: "PRISMA_INIT",
        detail:
          "Set DATABASE_URL to the Supabase Transaction pooler (port 6543, not db.*). Add ?pgbouncer=true&connection_limit=1&sslmode=require. On 5432 session pooler, omit pgbouncer. URL-encode password specials (e.g. @ as %40). Set this env on Vercel for Production/Preview.",
      },
    };
  }

  return {
    status: 500,
    body: { error: fallbackMessage },
  };
}
