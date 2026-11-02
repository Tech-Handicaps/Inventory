export const REPORTS_TABS = [
  { id: "start", label: "Start here" },
  { id: "monthly", label: "Monthly pack" },
  { id: "ytd", label: "Year to date" },
  { id: "history", label: "History (before this system)" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "stock", label: "Stock count" },
  { id: "assets", label: "Asset history" },
] as const;

export type ReportsTabId = (typeof REPORTS_TABS)[number]["id"];

export function parseReportsTab(value: string | string[] | undefined | null): ReportsTabId {
  const raw = Array.isArray(value) ? value[0] : value;
  return REPORTS_TABS.some((tab) => tab.id === raw) ? (raw as ReportsTabId) : "start";
}
