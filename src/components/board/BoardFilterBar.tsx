"use client";

import { Search, X } from "lucide-react";
import {
  MISSING_DATA_KEYS,
  MISSING_DATA_LABELS,
  NO_CLUB,
  hasActiveBoardFilters,
  type BoardFilters,
  type FilterOption,
} from "@/lib/inventory/board-filters";
import { EMPTY_BOARD_FILTERS } from "@/lib/inventory/board-filters";
import type { ReportAssetTypeId } from "@/lib/reports/asset-types";

type Options = {
  clubs: FilterOption[];
  noClubCount: number;
  types: FilterOption[];
  manufacturers: FilterOption[];
  models: FilterOption[];
};

const selectCls =
  "h-9 min-w-0 rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/30";

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
  extra,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${selectCls} ${value ? "border-brand/60" : ""}`}
      >
        <option value="">{allLabel}</option>
        {extra}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.count})
          </option>
        ))}
      </select>
    </label>
  );
}

export function BoardFilterBar({
  filters,
  options,
  shown,
  total,
  onChange,
}: {
  filters: BoardFilters;
  options: Options;
  shown: number;
  total: number;
  onChange: (next: BoardFilters) => void;
}) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch });
  const active = hasActiveBoardFilters(filters);

  return (
    <section
      aria-label="Board filters"
      className="rounded-lg border border-line bg-white px-3 py-2.5"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-[minmax(12rem,1.4fr)_repeat(4,minmax(0,1fr))]">
        <label className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-3 xl:col-span-1">
          <span className="text-xs font-medium text-muted">Search</span>
          <span className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              type="search"
              enterKeyHint="search"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Name, serial, club, model…"
              autoComplete="off"
              className={`${selectCls} w-full pl-8`}
            />
          </span>
        </label>
        <FilterSelect
          label="Club"
          value={filters.club}
          allLabel="All clubs"
          options={options.clubs}
          onChange={(club) => set({ club })}
          extra={
            options.noClubCount > 0 ? (
              <option value={NO_CLUB}>No club ({options.noClubCount})</option>
            ) : null
          }
        />
        <FilterSelect
          label="Type"
          value={filters.type}
          allLabel="All types"
          options={options.types}
          onChange={(type) => set({ type: type as ReportAssetTypeId | "" })}
        />
        <FilterSelect
          label="Manufacturer"
          value={filters.manufacturer}
          allLabel="All manufacturers"
          options={options.manufacturers}
          onChange={(manufacturer) => set({ manufacturer, model: "" })}
        />
        <FilterSelect
          label="Model"
          value={filters.model}
          allLabel="All models"
          options={options.models}
          onChange={(model) => set({ model })}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted">Missing data:</span>
        {MISSING_DATA_KEYS.map((key) => {
          const on = filters.missing.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() =>
                set({
                  missing: on
                    ? filters.missing.filter((k) => k !== key)
                    : [...filters.missing, key],
                })
              }
              className={`filter-pill ${on ? "filter-pill-active" : ""}`}
            >
              {MISSING_DATA_LABELS[key]}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted" aria-live="polite">
          {active ? `${shown} of ${total} shown` : `${total} units`}
          {active ? (
            <button
              type="button"
              onClick={() => onChange(EMPTY_BOARD_FILTERS)}
              className="inline-flex items-center gap-1 font-semibold text-brand-deep hover:underline"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          ) : null}
        </span>
      </div>
    </section>
  );
}
