import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { sanitizeColumns } from "@/lib/inventory/asset-table";
import {
  ALLOWED_PREFERENCE_KEYS,
  getUserPreference,
  setUserPreference,
} from "@/lib/preferences/user-preferences";

// GET /api/me/preferences?key=assets.columns
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!ALLOWED_PREFERENCE_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown preference key" }, { status: 400 });
  }
  return NextResponse.json({ key, value: await getUserPreference(auth.user.id, key) });
}

// PUT /api/me/preferences  { key, value }
export async function PUT(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => null)) as { key?: unknown; value?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key : "";
  if (!ALLOWED_PREFERENCE_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown preference key" }, { status: 400 });
  }
  const value = key === "assets.columns" ? sanitizeColumns(body?.value) : body?.value;
  try {
    await setUserPreference(auth.user.id, key, value);
    return NextResponse.json({ key, value });
  } catch (e) {
    console.error("PUT /api/me/preferences", e);
    return NextResponse.json({ error: "Could not save preference" }, { status: 500 });
  }
}
