import { DashboardView } from "./dashboard-client";
import { parseDashboardTab } from "@/lib/reports/dashboard-tabs";
import { requireOperationalSession } from "@/lib/auth/get-session-role";
import { loadDashboardOverview } from "@/lib/reports/dashboard-overview";

/** The Overview tab renders on the server; the other tabs load their figures in the browser. */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOperationalSession();
  const [overview, sp] = await Promise.all([loadDashboardOverview(), searchParams]);
  const tab = parseDashboardTab(typeof sp.tab === "string" ? sp.tab : undefined);
  return <DashboardView overview={overview} initialTab={tab} />;
}
