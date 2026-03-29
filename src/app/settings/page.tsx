"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InventoryHeader } from "@/components/InventoryHeader";
import { AuditLogSettingsSection } from "./audit-log-settings-section";
import { ZohoAssistSettingsSection } from "./zoho-settings-section";
import { DeviceTemplatesSettingsSection } from "./device-templates-settings-section";

const TABS = [
  { id: "zoho", label: "Zoho Assist API" },
  { id: "templates", label: "Device templates" },
  { id: "audit", label: "Audit log" },
] as const;

type SettingsTabId = (typeof TABS)[number]["id"];

function SettingsTabsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab");
  const tab: SettingsTabId =
    tabParam === "templates"
      ? "templates"
      : tabParam === "audit"
        ? "audit"
        : "zoho";

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

  return (
    <>
      <header className="mb-6">
        <h1 className="font-heading text-xl font-bold uppercase tracking-wide text-black">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-black/65">
          Zoho Assist API credentials, device templates, and the audit log
          (management only) live here.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-0 border-b border-black/10"
      >
        {TABS.map((t) => {
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
        <div
          id="settings-panel-zoho"
          role="tabpanel"
          aria-labelledby="settings-tab-zoho"
          hidden={tab !== "zoho"}
        >
          <ZohoAssistSettingsSection />
        </div>
        <div
          id="settings-panel-templates"
          role="tabpanel"
          aria-labelledby="settings-tab-templates"
          hidden={tab !== "templates"}
        >
          <DeviceTemplatesSettingsSection />
        </div>
        <div
          id="settings-panel-audit"
          role="tabpanel"
          aria-labelledby="settings-tab-audit"
          hidden={tab !== "audit"}
        >
          <AuditLogSettingsSection />
        </div>
      </div>
    </>
  );
}

function SettingsLoading() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-black/55">Loading settings…</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <InventoryHeader current="settings" />

      <main className="mx-auto max-w-5xl p-6">
        <Suspense fallback={<SettingsLoading />}>
          <SettingsTabsContent />
        </Suspense>
      </main>
    </div>
  );
}
