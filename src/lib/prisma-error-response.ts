import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * Prisma P2022 = DB schema behind Prisma schema (column/table missing). Not a pooler or auth issue.
 */
export function nextResponseIfPrismaSchemaDrift(
  error: unknown
): NextResponse | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  ) {
    return NextResponse.json(
      {
        error:
          "Database is missing columns this app expects (e.g. Asset.tags). Run: npm run db:push:schema. On Supabase, if db push hangs on the transaction pooler (port 6543), that script uses the session pooler (5432) automatically — see .env.example.",
        code: "SCHEMA_DRIFT",
      },
      { status: 503 }
    );
  }
  return null;
}
