import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { loginBodySchema } from "@/lib/auth/admin-user-schemas";
import { normalizeUsername } from "@/lib/auth/username";
import { jsonError } from "@/lib/api/error-response";
import { isNextResponse, parseJsonBody } from "@/lib/api/parse-json";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const INVALID = "Invalid username/email or password";

function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

function getSupabaseAnonKey(): string | undefined {
  const k =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return typeof k === "string" && k.trim() ? k.trim() : undefined;
}

/**
 * POST /api/auth/login — sign in with username or email + password.
 * Sets Supabase session cookies on the response.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, loginBodySchema);
  if (isNextResponse(parsed)) return parsed;

  const { identifier, password } = parsed;
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    return jsonError("Authentication is not configured.", 503);
  }

  let email: string | null = null;
  if (identifier.includes("@")) {
    email = identifier.trim().toLowerCase();
  } else {
    const username = normalizeUsername(identifier);
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { username },
        select: { userId: true },
      });
      if (!profile) {
        return jsonError(INVALID, 401);
      }
      const admin = createSupabaseAdmin();
      const { data, error } = await admin.auth.admin.getUserById(profile.userId);
      if (error || !data.user?.email) {
        return jsonError(INVALID, 401);
      }
      email = data.user.email.toLowerCase();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        return jsonError("Authentication is not configured.", 503);
      }
      console.error("POST /api/auth/login username resolve", e);
      return jsonError(INVALID, 401);
    }
  }

  let response = NextResponse.json({ ok: true });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        response = NextResponse.json({ ok: true });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return jsonError(INVALID, 401);
  }

  return response;
}
