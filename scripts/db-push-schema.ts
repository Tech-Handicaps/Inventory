/**
 * Apply Prisma schema to Supabase using the session pooler (port 5432).
 * `prisma db push` on the transaction pooler (6543) often hangs; this script
 * rewrites DATABASE_URL for a one-off push without changing your .env file.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function sessionPoolerUrlFromEnv(): string {
  const envPath = resolve(process.cwd(), ".env");
  const env = readFileSync(envPath, "utf8");
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (!m) {
    throw new Error("DATABASE_URL not found in .env");
  }
  let raw = m[1].trim().replace(/^['"]|['"]$/g, "");
  if (raw.startsWith("postgres://")) {
    raw = `postgresql://${raw.slice("postgres://".length)}`;
  }
  const u = new URL(raw);
  if (u.port === "6543") u.port = "5432";
  u.searchParams.delete("pgbouncer");
  u.searchParams.delete("connection_limit");
  if (!u.searchParams.get("sslmode")) u.searchParams.set("sslmode", "require");
  return u.toString();
}

const url = sessionPoolerUrlFromEnv();
console.info("[db:push:schema] Applying schema via session pooler (5432)…");
execSync("npx prisma db push", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
