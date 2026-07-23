import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicApiPath } from "@/lib/auth/public-api-paths";
import { isSupabaseAuthSessionMissingError } from "@/lib/auth/supabase-auth-errors";
import { safeRedirectPath } from "@/lib/http/safe-redirect";

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
 * Next.js 16+: `middleware` was renamed to `proxy`.
 * Refreshes Supabase session cookies and gates pages + `/api/*`.
 *
 * Do not call `request.cookies.set` — in the proxy runtime cookies are read-only;
 * only set cookies on the `NextResponse` (see Supabase SSR patterns for Next.js).
 */
export async function proxy(request: NextRequest) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !anonKey) {
    console.error(
      "proxy: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or publishable key) on Vercel."
    );
    const pathname = request.nextUrl.pathname;
    if (pathname === "/" || pathname === "/login") {
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: missing NEXT_PUBLIC_SUPABASE_URL or anon/publishable key",
        },
        { status: 503 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, anonKey, {
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
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: { id: string } | null = null;
  let authLookupFailed = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // No session cookie → logged-out (401), not auth-service outage (503).
      if (isSupabaseAuthSessionMissingError(error)) {
        user = null;
      } else {
        console.error("proxy: supabase.auth.getUser error", error.message);
        authLookupFailed = true;
        user = null;
      }
    } else {
      user = data.user;
    }
  } catch (e) {
    console.error("proxy: supabase.auth.getUser failed", e);
    authLookupFailed = true;
    user = null;
  }

  const pathname = request.nextUrl.pathname;

  const isPublicAsset =
    pathname.startsWith("/brand/") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname);

  if (isPublicAsset) {
    return supabaseResponse;
  }

  /** Marketing home (`/`) and credential page (`/login`) — no session required. */
  const isPublicPage = pathname === "/" || pathname === "/login";

  /** Unauthenticated API allowlist — handlers enforce their own secrets / public contract. */
  if (pathname.startsWith("/api/")) {
    if (isPublicApiPath(pathname)) {
      return supabaseResponse;
    }
    if (authLookupFailed) {
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return supabaseResponse;
  }

  if (!isPublicPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", safeRedirectPath(pathname, "/inventory"));
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/inventory", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
