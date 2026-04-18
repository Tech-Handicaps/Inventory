/**
 * Supabase + Prisma on serverless (Vercel): use the **Transaction pooler** (port **6543**)
 * with `pgbouncer=true`, `sslmode=require`, `connection_limit=1`.
 * Session pooler (port **5432**) caps connections (~15) → `EMAXCONNSESSION` under load.
 * See `.env.example` and https://www.prisma.io/docs/guides/database/supabase
 */

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
      /** Supabase session pooler — only ~15 concurrent clients; wrong for Vercel. */
      isSupabaseSessionPooler: boolean;
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
    const hostname = u.hostname;
    const isSupabasePoolerHost = hostname.includes("pooler.supabase.com");
    const isSupabaseSessionPooler =
      isSupabasePoolerHost && port === "5432";

    return {
      parseOk: true,
      hostname,
      port,
      pgbouncerTrue: sp.get("pgbouncer") === "true",
      sslmodeRequire: sp.get("sslmode") === "require",
      usesPort6543: port === "6543",
      isSupabaseSessionPooler,
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
  hints: ReturnType<typeof getDatabaseUrlHints>,
  databaseError?: string | null
): string | null {
  if (!hints.parseOk) {
    return "DATABASE_URL could not be parsed — use a single line in Vercel, wrap in quotes if needed, URL-encode @ in the password as %40.";
  }
  const parts: string[] = [];

  const err = databaseError ?? "";
  const looksLikePreparedStatementConflict =
    /\b42P05\b/i.test(err) ||
    /prepared statement.*already exists/i.test(err);

  if (hints.isSupabaseSessionPooler) {
    parts.push(
      "You are using Supabase Session pooler (port 5432). It allows only ~15 concurrent clients — Vercel serverless will throw EMAXCONNSESSION / max clients reached. Replace DATABASE_URL with the Transaction pooler URI: port 6543 and query params sslmode=require&pgbouncer=true&connection_limit=1 (Supabase Dashboard → Connect → Transaction pooler)."
    );
  }

  if (hints.usesPort6543 && !hints.pgbouncerTrue) {
    parts.push(
      looksLikePreparedStatementConflict
        ? "SQLSTATE 42P05 / “prepared statement already exists” = Prisma is talking to PgBouncer without pgbouncer=true. Add pgbouncer=true (and sslmode=require) so Prisma disables incompatible prepared statements."
        : "Port 6543 (transaction pooler) requires pgbouncer=true in the query string for Prisma (otherwise you may see SQLSTATE 42P05). Also add sslmode=require."
    );
  }
  if (!hints.sslmodeRequire && hints.hostname.includes("supabase")) {
    parts.push("Add sslmode=require for Supabase.");
  }
  if (
    !hints.isSupabaseSessionPooler &&
    !hints.usesPort6543 &&
    hints.hostname.includes("pooler.supabase.com")
  ) {
    parts.push(
      "Supabase pooler host should use port 6543 (transaction mode) for serverless, not session mode on 5432."
    );
  }
  return parts.length ? parts.join(" ") : null;
}

export function warnIfLikelyMisconfiguredDatabaseUrl(): void {
  const hints = getDatabaseUrlHints();
  if (!hints.parseOk) return;

  if (hints.isSupabaseSessionPooler) {
    console.warn(
      "[prisma] DATABASE_URL uses Supabase Session pooler (port 5432). " +
        "Vercel will exceed the ~15 connection cap (EMAXCONNSESSION). " +
        "Use Transaction pooler: port 6543 + ?sslmode=require&pgbouncer=true&connection_limit=1. See .env.example."
    );
  }

  if (hints.usesPort6543 && !hints.pgbouncerTrue) {
    console.warn(
      "[prisma] DATABASE_URL uses port 6543 but is missing `pgbouncer=true`. " +
        "Without it, PgBouncer can return SQLSTATE 42P05 (prepared statement already exists). " +
        "Add ?sslmode=require&pgbouncer=true&connection_limit=1 — see .env.example."
    );
  }
}
