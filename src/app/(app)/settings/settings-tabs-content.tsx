"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Headset,
  History,
  Layers,
  Mail,
  Plug,
  Users,
} from "lucide-react";
import { useAppRole } from "@/components/RoleProvider";
import type { AppRole } from "@/lib/auth/roles";
import { hasFullNavAccess } from "@/lib/auth/nav-access";
import { AuditLogSettingsSection } from "./audit-log-settings-section";
import { ClubsSettingsSection } from "./clubs-settings-section";
import { DeviceTemplatesSettingsSection } from "./device-templates-settings-section";
import { EmailNotificationsSettingsSection } from "./email-notifications-settings-section";
import { UserManagementSettingsSection } from "./user-management-settings-section";
import { ZohoDeskSettingsSection } from "./zoho-desk-settings-section";
import { ZohoAssistSettingsSection } from "./zoho-settings-section";

const ALL_TABS = [
  { id: "zoho" as const, label: "Zoho Assist", icon: Plug },
  { id: "zoho-desk" as const, label: "Zoho Desk", icon: Headset },
  { id: "templates" as const, label: "Device templates", icon: Layers },
  { id: "clubs" as const, label: "Clubs", icon: Building2 },
  { id: "audit" as const, label: "Audit log", icon: History },
  { id: "email" as const, label: "Email & finance", icon: Mail },
  { id: "users" as const, label: "Users", icon: Users },
] as const;

type SettingsTabId = (typeof ALL_TABS)[number]["id"];

function tabsForRole(role: AppRole | null, loading: boolean) {
  if (hasFullNavAccess(role)) {
    return [...ALL_TABS];
  }
  if (loading || !role) {
    return ALL_TABS.filter((t) => t.id !== "users" && t.id !== "email");
  }
  if (role === "accountant") {
    return ALL_TABS.filter((t) => t.id === "templates" || t.id === "clubs");
  }
  return ALL_TABS.filter((t) => t.id !== "users" && t.id !== "email");
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
      : tabParam === "clubs"
        ? "clubs"
        : tabParam === "audit"
        ? "audit"
        : tabParam === "email"
          ? "email"
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
      ? "Device templates and clubs — reusable presets for hardware and site names."
      : hasFullNavAccess(role) && !loading
        ? "Integrations, templates, audit trail, finance email, and user access."
        : "Integrations, templates, and audit history.";

  const activeLabel =
    visibleTabs.find((t) => t.id === tab)?.label ?? "Settings";

  function renderActivePanel() {
    switch (tab) {
      case "zoho":
        return <ZohoAssistSettingsSection />;
      case "zoho-desk":
        return <ZohoDeskSettingsSection />;
      case "templates":
        return <DeviceTemplatesSettingsSection />;
      case "clubs":
        return <ClubsSettingsSection />;
      case "audit":
        return <AuditLogSettingsSection />;
      case "email":
        return <EmailNotificationsSettingsSection />;
      case "users":
        return <UserManagementSettingsSection />;
      default:
        return null;
    }
  }

  return (
    <>
      <section className="page-hero mb-6">
        <div className="page-hero-blob page-hero-blob-a" aria-hidden />
        <div className="relative">
          <p className="page-eyebrow">Configuration</p>
          <h1 className="page-title brand-gradient-text">Settings</h1>
          <p className="page-description">{subtitle}</p>
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav
          role="tablist"
          aria-label="Settings sections"
          className="flex gap-2 overflow-x-auto pb-1 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {visibleTabs.map((t) => {
            const selected = tab === t.id;
            const Icon = t.icon;
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
                className={`nav-link w-full shrink-0 ${
                  selected ? "nav-link-active" : "nav-link-inactive"
                }`}
              >
                <span className="nav-icon-pill">
                  <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </span>
                <span className="truncate">{t.label}</span>
                {selected ? (
                  <span
                    className="ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full bg-brand lg:block"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          <p className="font-heading mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-black/45 lg:hidden">
            {activeLabel}
          </p>
          <div
            className="glass-card p-5 sm:p-6"
            role="tabpanel"
            id={`settings-panel-${tab}`}
            aria-labelledby={`settings-tab-${tab}`}
          >
            {renderActivePanel()}
          </div>
        </div>
      </div>
    </>
  );
}
