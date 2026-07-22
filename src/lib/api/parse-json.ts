import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api/error-response";

/**
 * Parse JSON body with a Zod schema. Returns data or a 400 NextResponse.
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400, { code: "INVALID_JSON" });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first
      ? `${first.path.join(".") || "body"}: ${first.message}`
      : "Invalid request body";
    return jsonError(msg, 400, { code: "VALIDATION_ERROR" });
  }
  return parsed.data;
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
