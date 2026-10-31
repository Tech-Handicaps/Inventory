import { afterEach, describe, expect, it } from "vitest";
import { normalizeDatabaseUrlForPrisma } from "@/lib/prisma-connection";

const TXN_URL =
  "postgresql://postgres.test:secret@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1";

describe("normalizeDatabaseUrlForPrisma", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses session pooler in development for Supabase transaction URLs", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      PRISMA_USE_TRANSACTION_POOLER: undefined,
    };
    const out = normalizeDatabaseUrlForPrisma(TXN_URL);
    expect(out).toContain(":5432/");
    expect(out).not.toContain("pgbouncer=true");
    expect(out).toContain("connection_limit=5");
  });

  it("keeps transaction pooler in development when opted in", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      PRISMA_USE_TRANSACTION_POOLER: "1",
    };
    const out = normalizeDatabaseUrlForPrisma(TXN_URL);
    expect(out).toContain(":6543/");
    expect(out).toContain("pgbouncer=true");
  });

  it("keeps transaction pooler in production", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
    };
    const out = normalizeDatabaseUrlForPrisma(TXN_URL);
    expect(out).toContain(":6543/");
    expect(out).toContain("pgbouncer=true");
  });

  it("raises connection_limit=1 so parallel queries are not serialised", () => {
    process.env = { ...originalEnv, NODE_ENV: "production", PRISMA_CONNECTION_LIMIT: undefined };
    expect(normalizeDatabaseUrlForPrisma(TXN_URL)).toContain("connection_limit=5");
  });

  it("honours PRISMA_CONNECTION_LIMIT", () => {
    process.env = { ...originalEnv, NODE_ENV: "production", PRISMA_CONNECTION_LIMIT: "1" };
    expect(normalizeDatabaseUrlForPrisma(TXN_URL)).toContain("connection_limit=1");
  });
});
