"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppRole } from "@/components/RoleProvider";
import type { AppRole } from "@/lib/auth/roles";
import { AuditLogSettingsSection } from "./audit-log-settings-section";
import { DeviceTemplatesSettingsSection } from "./device-templates-settings-section";
import { UserManagementSettingsSection } from "./user-management-settings-section";
import { ZohoDeskSettingsSection } from "./zoho-desk-settings-section";
import { ZohoAssistSettingsSection } from "./zoho-settings-section";

const ALL_TABS = [
  { id: "zoho" as const, label: "Zoho Assist API" },
  { id: "zoho-desk" as const, label: "Zoho Desk API" },
  { id: "templates" as const, label: "Device templates" },
  { id: "audit" as const, label: "Audit log" },
  { id: "users" as const, label: "Users" },
] as const;

type SettingsTabId = (typeof ALL_TABS)[number]["id"];

function tabsForRole(role: AppRole | null, loading: boolean) {
  if (loading || !role) {
    return ALL_TABS.filter((t) => t.id !== "users");
  }
  if (role === "accountant") {
    return ALL_TABS.filter((t) => t.id === "templates");
  }
  if (role === "super_admin") {
    return [...ALL_TABS];
  }
  return ALL_TABS.filter((t) => t.id !== "users");
}

export function SettingsTabsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { role, loading } = useAppRole();

  const visibleTabs = useMemo(
    () => tabsForRole(role, loading),
    [role, loading]
  );

  const tabParam = searchParams.get("tab");
  const requested: SettingsTabId =
    tabParam === "templates"
      ? "templates"
      : tabParam === "audit"
        ? "audit"
        : tabParam === "users"
          ? "users"
          : tabParam === "zoho-desk"
            ? "zoho-desk"
            : "zoho";

  const tab: SettingsTabId = useMemo(() => {
    const allowed = new Set(visibleTabs.map((t) => t.id));
    if (allowed.has(requested)) return requested;
    return visibleTabs[0]?.id ?? "templates";
  }, [visibleTabs, requested]);

  function selectTab(next: SettingsTabId) {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "zoho") {
      p.delete("tab");
    } else {
      p.set("tab", next);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const subtitle =
    role === "accountant" && !loading
      ? "Device templates for reusable make, model, and category presets."
      : role === "super_admin" && !loading
        ? "Zoho Assist, Zoho Desk, device templates, audit log, and user invites (super admin only)."
        : "Zoho Assist and Desk APIs, device templates, and the audit log live here.";

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-xl font-bold uppercase tracking-wide text-black">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-black/65">{subtitle}</p>
      </header>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-0 border-b border-black/10"
      >
        {visibleTabs.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={`font-heading -mb-px border-b-2 px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                selected
                  ? "border-brand bg-white text-black"
                  : "border-transparent text-black/45 hover:border-black/15 hover:text-black/75"
              } `}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="border border-t-0 border-black/10 bg-white p-6 shadow-sm">
        {visibleTabs.some((t) => t.id === "zoho") ? (
          <div
            id="settings-panel-zoho"
            role="tabpanel"
            aria-labelledby="settings-tab-zoho"
            hidden={tab !== "zoho"}
          >
            <ZohoAssistSettingsSection />
          </div>
        ) : null}
        {visibleTabs.some((t) => t.id === "zoho-desk") ? (
          <div
            id="settings-panel-zoho-desk"
            role="tabpanel"
            aria-labelledby="settings-tab-zoho-desk"
            hidden={tab !== "zoho-desk"}
          >
            <ZohoDeskSettingsSection />
          </div>
        ) : null}
        <div
          id="settings-panel-templates"
          role="tabpanel"
          aria-labelledby="settings-tab-templates"
          hidden={tab !== "templates"}
        >
          <DeviceTemplatesSettingsSection />
        </div>
        {visibleTabs.some((t) => t.id === "audit") ? (
          <div
            id="settings-panel-audit"
            role="tabpanel"
            aria-labelledby="settings-tab-audit"
            hidden={tab !== "audit"}
          >
            <AuditLogSettingsSection />
          </div>
        ) : null}
        {visibleTabs.some((t) => t.id === "users") ? (
          <div
            id="settings-panel-users"
            role="tabpanel"
            aria-labelledby="settings-tab-users"
            hidden={tab !== "users"}
          >
            <UserManagementSettingsSection />
          </div>
        ) : null}
      </div>
    </>
  );
}
