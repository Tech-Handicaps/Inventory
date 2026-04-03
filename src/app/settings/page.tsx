"use client";

import { Suspense } from "react";
import { InventoryHeader } from "@/components/InventoryHeader";
import { SettingsTabsContent } from "./settings-tabs-content";

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
