import { NextResponse } from "next/server";
import {
  connectionHintFromUrlHints,
  getDatabaseUrlHints,
  normalizeDatabaseUrlForPrisma,
  sanitizeDatabaseError,
} from "@/lib/prisma-connection";
import { prisma } from "@/lib/prisma";

/**
 * Deployment diagnostics (no secrets). Use after Vercel deploy: GET /api/health
 * — 200 means env present and DB accepts a query; 503 lists what failed.
 */
export async function GET() {
  const hasSupabaseUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
  const hasSupabaseKey = Boolean(
    (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )?.trim()
  );
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

  let databaseConnected = false;
  let databaseError: string | null = null;
  if (hasDatabaseUrl) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseConnected = true;
    } catch (e) {
      databaseConnected = false;
      databaseError = sanitizeDatabaseError(e);
    }
  }

  const ok =
    hasSupabaseUrl && hasSupabaseKey && hasDatabaseUrl && databaseConnected;

  const urlHints = hasDatabaseUrl
    ? getDatabaseUrlHints(
        normalizeDatabaseUrlForPrisma(process.env.DATABASE_URL)
      )
    : null;
  const urlStructureHint =
    !databaseConnected && hasDatabaseUrl && urlHints
      ? connectionHintFromUrlHints(urlHints, databaseError)
      : null;

  const hint = ok
    ? null
    : [
        !hasSupabaseUrl || !hasSupabaseKey
          ? "Set NEXT_PUBLIC_SUPABASE_* in Vercel (Production)."
          : null,
        !hasDatabaseUrl ? "Set DATABASE_URL in Vercel (Production)." : null,
        hasDatabaseUrl && !databaseConnected
          ? "Database URL is set but Prisma cannot connect. Read databaseError and databaseUrlHints below."
          : null,
        urlStructureHint,
        hasDatabaseUrl && !databaseConnected
          ? "Typical fix (Supabase + Vercel): Dashboard → Connect → Transaction pooler → copy URI; append or verify ?sslmode=require&pgbouncer=true&connection_limit=1; redeploy."
          : null,
      ]
        .filter(Boolean)
        .join(" ");

  return NextResponse.json(
    {
      ok,
      checks: {
        nextPublicSupabaseUrl: hasSupabaseUrl,
        nextPublicSupabaseKey: hasSupabaseKey,
        databaseUrlSet: hasDatabaseUrl,
        databaseConnected,
      },
      databaseError,
      databaseUrlHints: urlHints,
      hint: hint || null,
    },
    { status: ok ? 200 : 503 }
  );
}
