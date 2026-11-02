"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { SectionSkeleton } from "@/components/Skeleton";
import StartTab from "./start-tab";
import { REPORTS_TABS, parseReportsTab, type ReportsTabId } from "./tabs";

const loading = () => <SectionSkeleton label="Loading" />;

const MonthlyTab = dynamic(() => import("./monthly-tab"), { loading });
const YtdTab = dynamic(() => import("./ytd-tab"), { loading });
const HistoryTab = dynamic(() => import("./history-tab"), { loading });
const ReconciliationTab = dynamic(() => import("./reconciliation-tab"), { loading });
const StockTab = dynamic(() => import("./stock-tab"), { loading });
const AssetsTab = dynamic(() => import("./assets-tab"), { loading });

export function ReportsTabs({ initialTab }: { initialTab: ReportsTabId }) {
  const [tab, setTab] = useState<ReportsTabId>(initialTab);

  const openTab = useCallback((next: ReportsTabId) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "start") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.pushState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setTab(parseReportsTab(new URL(window.location.href).searchParams.get("tab")));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      <nav
        aria-label="Report sections"
        className="sticky top-[65px] z-20 -mx-6 border-b border-line bg-white/95 px-6 backdrop-blur"
      >
        <div role="tablist" className="scrollbar-none flex gap-1 overflow-x-auto py-2">
          {REPORTS_TABS.map((t) => (
            <a
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              href={t.id === "start" ? "/reports" : `/reports?tab=${t.id}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                openTab(t.id);
              }}
              className={`shrink-0 whitespace-nowrap ${tab === t.id ? "filter-pill filter-pill-active" : "filter-pill filter-pill-inactive"}`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </nav>
      <div role="tabpanel" className="pt-6">
        {tab === "start" ? <StartTab onOpenTab={openTab} /> : null}
        {tab === "monthly" ? <MonthlyTab /> : null}
        {tab === "ytd" ? <YtdTab /> : null}
        {tab === "history" ? <HistoryTab /> : null}
        {tab === "reconciliation" ? <ReconciliationTab /> : null}
        {tab === "stock" ? <StockTab /> : null}
        {tab === "assets" ? <AssetsTab /> : null}
      </div>
    </>
  );
}
