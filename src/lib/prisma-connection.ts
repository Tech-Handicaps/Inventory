/**
 * Supabase + Prisma on serverless (Vercel): the **Transaction pooler** URI (port 6543)
 * must include `pgbouncer=true` (and usually `sslmode=require`, `connection_limit=1`).
 * See `.env.example` and https://www.prisma.io/docs/guides/database/supabase
 */
export function warnIfLikelyMisconfiguredDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return;

  const lower = raw.toLowerCase();
  const looksPooler =
    lower.includes(":6543/") ||
    lower.includes("pooler.supabase.com") ||
    lower.includes("pooler");

  if (looksPooler && !lower.includes("pgbouncer=true")) {
    console.warn(
      "[prisma] DATABASE_URL looks like a Supabase pooler URL but is missing `pgbouncer=true`. " +
        "Prisma often fails with PrismaClientInitializationError until you add it (and use `sslmode=require`). " +
        "Copy the Transaction pooler string from Supabase Dashboard → Connect, or see .env.example."
    );
  }
}

/** Strip credentials from accidental URL echoes in error strings. */
export function sanitizeDatabaseError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***@")
    .replace(/postgres:\/\/[^@\s]+@/gi, "postgres://***@")
    .slice(0, 800);
}

/**
 * Non-secret facts about DATABASE_URL for /api/health when debugging connection failures.
 */
export function getDatabaseUrlHints():
  | {
      hostname: string;
      port: string;
      pgbouncerTrue: boolean;
      sslmodeRequire: boolean;
      usesPort6543: boolean;
      parseOk: true;
    }
  | { parseOk: false; parseError: string } {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    return { parseOk: false, parseError: "DATABASE_URL is empty" };
  }
  try {
    const normalized = raw.startsWith("postgres://")
      ? `postgresql://${raw.slice("postgres://".length)}`
      : raw;
    const u = new URL(normalized);
    const port = u.port || "5432";
    const sp = u.searchParams;
    return {
      parseOk: true,
      hostname: u.hostname,
      port,
      pgbouncerTrue: sp.get("pgbouncer") === "true",
      sslmodeRequire: sp.get("sslmode") === "require",
      usesPort6543: port === "6543",
    };
  } catch (e) {
    return {
      parseOk: false,
      parseError:
        e instanceof Error ? e.message : "Invalid DATABASE_URL (check quoting and encoding)",
    };
  }
}

export function connectionHintFromUrlHints(
  hints: ReturnType<typeof getDatabaseUrlHints>
): string | null {
  if (!hints.parseOk) {
    return "DATABASE_URL could not be parsed — use a single line in Vercel, wrap in quotes if needed, URL-encode @ in the password as %40.";
  }
  const parts: string[] = [];
  if (hints.usesPort6543 && !hints.pgbouncerTrue) {
    parts.push(
      "Port 6543 (pooler) requires pgbouncer=true in the query string for Prisma."
    );
  }
  if (!hints.sslmodeRequire && hints.hostname.includes("supabase")) {
    parts.push("Add sslmode=require for Supabase.");
  }
  if (!hints.usesPort6543 && hints.hostname.includes("pooler.supabase.com")) {
    parts.push(
      "Supabase pooler hostnames usually use port 6543 (transaction mode) for serverless."
    );
  }
  return parts.length ? parts.join(" ") : null;
}
