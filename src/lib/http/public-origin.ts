import type { NextRequest } from "next/server";

/**
 * Browser-facing origin for building OAuth redirect URIs and post-login redirects.
 * Prefer forwarded headers behind proxies (Vercel, etc.), else the request URL —
 * avoids "Invalid Redirect URI" when NEXT_PUBLIC_APP_URL differs from how you open
 * the app (localhost vs 127.0.0.1, port, LAN IP, www, etc.).
 */
export function getPublicOriginFromRequest(request: NextRequest): string {
  const fwdHostRaw = request.headers.get("x-forwarded-host");
  const fwdProtoRaw = request.headers.get("x-forwarded-proto");

  if (fwdHostRaw && fwdProtoRaw) {
    const host = fwdHostRaw.split(",")[0].trim();
    const proto = fwdProtoRaw.split(",")[0].trim();
    if (host.length > 0 && proto.length > 0) {
      return `${proto}://${host}`;
    }
  }

  const origin = request.nextUrl.origin;
  if (origin && origin !== "null") {
    return origin;
  }

  const env =
    typeof process.env.NEXT_PUBLIC_APP_URL === "string"
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "").trim()
      : "";
  if (env.length > 0) {
    return env;
  }

  return "http://localhost:3000";
}
