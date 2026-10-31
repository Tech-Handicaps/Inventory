import { NextRequest } from "next/server";
import { GET as assetGeo } from "@/app/api/reports/asset-geo/route";
import { GET as dashboardSummary } from "@/app/api/reports/dashboard-summary/route";
import { GET as hardwareProcurement } from "@/app/api/reports/hardware-procurement/route";
import { GET as refurbished } from "@/app/api/reports/refurbished/route";
import { GET as repairs } from "@/app/api/reports/repairs/route";
import { GET as stock } from "@/app/api/reports/stock/route";
import { GET as writeoffs } from "@/app/api/reports/writeoffs/route";
import { GET as xeroHealth } from "@/app/api/xero/health/route";

type SectionHandler = (request: NextRequest) => Promise<Response>;

const SECTIONS: Record<string, { path: string; handler: SectionHandler }> = {
  stock: { path: "/api/reports/stock", handler: stock },
  repairs: { path: "/api/reports/repairs", handler: repairs },
  refurbished: { path: "/api/reports/refurbished", handler: refurbished },
  writeoffs: { path: "/api/reports/writeoffs", handler: writeoffs },
  summary: { path: "/api/reports/dashboard-summary", handler: dashboardSummary },
  xeroHealth: { path: "/api/xero/health", handler: xeroHealth },
  fleet: { path: "/api/reports/hardware-procurement", handler: hardwareProcurement },
  assetGeo: { path: "/api/reports/asset-geo", handler: assetGeo },
};

export type DashboardBundleSection = { data: unknown; error: string | null };

/**
 * Every Dashboard section, run in-process. Each section goes through its own route handler
 * (and its own role check) under its own path, using the caller's cookies.
 */
export async function loadDashboardBundle(
  origin: string,
  headers: Headers
): Promise<Record<string, DashboardBundleSection>> {
  const entries = await Promise.all(
    Object.entries(SECTIONS).map(async ([key, { path, handler }]) => {
      try {
        const res = await handler(new NextRequest(new URL(path, origin), { headers }));
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const error =
            body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
              ? (body as { error: string }).error
              : `Failed to load ${path}`;
          return [key, { data: null, error }] as const;
        }
        return [key, { data: body, error: null }] as const;
      } catch (e) {
        console.error(`dashboard bundle ${path}`, e);
        return [key, { data: null, error: `Failed to load ${path}` }] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}
