"use client";

import { Suspense } from "react";
import { SettingsSkeleton } from "@/components/Skeleton";
import { SettingsTabsContent } from "./settings-tabs-content";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsTabsContent />
      </Suspense>
    </main>
  );
}
