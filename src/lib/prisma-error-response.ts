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
          "Database is missing columns this app expects (e.g. Asset.purchaseDate). Run: npx prisma db push. On Supabase, if db push hangs on the transaction pooler (port 6543), use the Session pooler (port 5432) URI from Dashboard → Connect for that command only, or add DIRECT_URL (see .env.example).",
        code: "SCHEMA_DRIFT",
      },
      { status: 503 }
    );
  }
  return null;
}
