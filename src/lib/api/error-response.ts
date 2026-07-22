import { NextResponse } from "next/server";
import { nextResponseIfPrismaSchemaDrift } from "@/lib/prisma-error-response";
import { prismaMutationError } from "@/lib/prisma/error-response";

export type ApiErrorBody = {
  error: string;
  code?: string;
  prismaCode?: string;
};

/**
 * Stable JSON error for API routes. Prefer this over returning raw Error.message.
 */
export function jsonError(
  error: string,
  status: number,
  extras?: Omit<ApiErrorBody, "error">
): NextResponse {
  const body: ApiErrorBody = { error, ...extras };
  return NextResponse.json(body, { status });
}

/**
 * Map caught errors to a safe NextResponse (Prisma drift / mutation / generic).
 * Logs the original error with a stable prefix for greppable Vercel logs.
 */
export function catchToJsonError(
  logPrefix: string,
  error: unknown,
  fallbackMessage = "Server error"
): NextResponse {
  console.error(logPrefix, error);

  const drift = nextResponseIfPrismaSchemaDrift(error);
  if (drift) return drift;

  const mapped = prismaMutationError(error, fallbackMessage);
  return NextResponse.json(mapped.body, { status: mapped.status });
}

/** Public message from an Error without leaking internals to clients. */
export function publicErrorMessage(
  error: unknown,
  fallback = "Request failed"
): string {
  if (error instanceof Error && error.message && !looksInternal(error.message)) {
    return error.message;
  }
  return fallback;
}

function looksInternal(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("prisma") ||
    m.includes("econnrefused") ||
    m.includes("password") ||
    m.includes("secret") ||
    m.includes("stack") ||
    m.includes("supabase_service") ||
    message.length > 280
  );
}
