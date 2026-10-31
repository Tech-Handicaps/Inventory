import { headers } from "next/headers";
import { DashboardView, type DashboardBundle } from "./dashboard-client";
import { requireOperationalSession } from "@/lib/auth/get-session-role";
import { loadDashboardBundle } from "@/lib/reports/dashboard-bundle";

/** Loads every dashboard section on the server so the first paint already has figures. */
export default async function DashboardPage() {
  await requireOperationalSession();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const bundle = await loadDashboardBundle(`${proto}://${host}`, new Headers(h)).catch((e) => {
    console.error("dashboard page: server load failed; the dashboard will load in the browser", e);
    return null;
  });
  return <DashboardView initialBundle={bundle as DashboardBundle | null} />;
}
