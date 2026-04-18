import { NextResponse } from "next/server";
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
  if (hasDatabaseUrl) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseConnected = true;
    } catch {
      databaseConnected = false;
    }
  }

  const ok =
    hasSupabaseUrl && hasSupabaseKey && hasDatabaseUrl && databaseConnected;

  return NextResponse.json(
    {
      ok,
      checks: {
        nextPublicSupabaseUrl: hasSupabaseUrl,
        nextPublicSupabaseKey: hasSupabaseKey,
        databaseUrlSet: hasDatabaseUrl,
        databaseConnected,
      },
      hint: ok
        ? null
        : "Fix failing checks in Vercel env, use pooled DATABASE_URL on serverless, run prisma migrate deploy against production DB, then redeploy.",
    },
    { status: ok ? 200 : 503 }
  );
}
