export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "fleet", label: "Fleet insights" },
  { id: "activity", label: "Activity" },
  { id: "sync", label: "Locations & sync" },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["id"];

export function parseDashboardTab(value: string | undefined): DashboardTab {
  return DASHBOARD_TABS.some((t) => t.id === value) ? (value as DashboardTab) : "overview";
}
