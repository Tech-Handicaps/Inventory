import type { Role } from "@/lib/auth/roles";

/**
 * Minimum role required for each API route (method + path).
 * Paths must match request.nextUrl.pathname (no query string, no trailing slash except root).
 * Dynamic segments use pattern matching before exact map lookup.
 */
export function getRequiredRoleForRoute(method: string, pathname: string): Role {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if (/^\/api\/assets\/[^/]+$/.test(path)) {
    if (method === "GET") return "operations";
    // Board moves and field updates: operations; creating assets stays POST /api/assets → accounts
    if (method === "PUT") return "operations";
  }

  if (/^\/api\/device-templates\/[^/]+$/.test(path)) {
    if (method === "PUT" || method === "DELETE") return "accounts";
  }

  const key = `${method} ${path}`;
  const exact = EXACT_ROUTE_ROLES[key];
  if (exact) return exact;

  console.warn(`RBAC: unmapped API route ${key} — requiring management`);
  return "management";
}

const EXACT_ROUTE_ROLES: Record<string, Role> = {
  "GET /api/assets": "operations",
  "POST /api/assets": "accounts",
  "GET /api/statuses": "operations",
  "GET /api/repairs": "operations",
  "POST /api/repairs": "accounts",
  "GET /api/reports/stock": "operations",
  "GET /api/reports/repairs": "operations",
  "GET /api/reports/refurbished": "operations",
  "GET /api/reports/writeoffs": "accounts",
  "GET /api/reports/pdf": "operations",
  "GET /api/xero/health": "operations",
  "POST /api/xero/sync": "accounts",
  "GET /api/xero/callback": "accounts",
  "GET /api/device-templates": "operations",
  "POST /api/device-templates": "accounts",
  "GET /api/settings/zoho": "accounts",
  "PUT /api/settings/zoho": "accounts",
  "POST /api/settings/zoho/test": "accounts",
  "GET /api/settings/zoho/oauth-url": "accounts",
  "GET /api/settings/zoho/callback": "accounts",
};
