"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { AssetDetailPanel } from "@/components/assets/AssetDetailPanel";
import { ColumnPicker } from "@/components/assets/ColumnPicker";
import { EditAssetModal } from "@/components/EditAssetModal";
import { ImportAssistAssetModal } from "@/components/ImportAssistAssetModal";
import { useToast } from "@/components/ToastProvider";
import { AssetTagChips } from "@/components/ui/AssetTagChips";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { PageHeader } from "@/components/ui/PageHeader";
import { STAGE_DOT } from "@/components/board/types";
import { HARDWARE_CREATED_EVENT, openAddHardware } from "@/lib/client/add-hardware";
import { formatDate } from "@/lib/dates/format";
import { formatGeoLabel } from "@/lib/geo/region-display";
import {
  displayAssetManufacturer,
  displayAssetModel,
} from "@/lib/inventory/asset-hardware-display";
import {
  ASSET_COLUMNS,
  ASSET_COLUMNS_PREFERENCE_KEY,
  AVAILABLE_STATUS_PARAM,
  DEFAULT_ASSET_COLUMNS,
  MISSING_FILTERS,
  NO_CLUB_PARAM,
  PAGE_SIZES,
  assetListSearch,
  type AssetColumnId,
  type AssetListParams,
  type PageSize,
  type SortKey,
} from "@/lib/inventory/asset-table";
import { displayDeviceTemplateLabel } from "@/lib/inventory/device-template-label";
import { assetLocation } from "@/lib/inventory/asset-location";

export type AssetRow = {
  id: string;
  assetName: string;
  category: string;
  tags?: string[] | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  dataSource: string;
  deviceLocation: string | null;
  processorName: string | null;
  systemRam: string | null;
  systemGpu: string | null;
  zohoAssistDeviceId: string | null;
  status: { id: string; code: string; label: string };
  deviceTemplate?: { id: string; label: string; manufacturer?: string | null; model?: string | null } | null;
  club?: { id: string; name: string } | null;
  reason: string | null;
  dateAdded: string;
  dateUpdated: string;
  purchaseDate: string | null;
  warrantyEndDate: string | null;
  publicIp: string | null;
  geoCountryCode: string | null;
  geoRegionCode: string | null;
  geoRegionName: string | null;
  geoCity: string | null;
  assessments?: { referenceNumber: string }[];
};

type Status = { id: string; code: string; label: string };
type Club = { id: string; name: string };

type Props = {
  params: AssetListParams;
  assets: AssetRow[];
  total: number;
  loadError: string | null;
  statuses: Status[];
  clubs: Club[];
  initialColumns: AssetColumnId[];
};

const DASH = "—";

function Truncated({ value, mono }: { value: string | null | undefined; mono?: boolean }) {
  if (!value) return <span className="text-muted">{DASH}</span>;
  return (
    <span className={`block truncate ${mono ? "font-mono text-xs" : ""}`} data-tip={value}>
      {value}
    </span>
  );
}

type Tip = { text: string; left: number; top: number };

/** Full text for a cut-off cell. Fixed-positioned so the scrolling table can't clip it. */
function useCellTooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const show = useCallback((target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest<HTMLElement>("[data-tip]") : null;
    if (!el || el.scrollWidth <= el.clientWidth) {
      setTip(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTip({ text: el.dataset.tip ?? "", left: Math.min(r.left, window.innerWidth - 336), top: r.bottom + 6 });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const node = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-40 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs leading-snug text-white shadow-lg"
      style={{ left: Math.max(8, tip.left), top: tip.top }}
    >
      {tip.text}
    </div>
  ) : null;
  return { show, hide, node };
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-white px-2 py-0.5 text-xs font-medium text-ink">
      <span className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[status.code] ?? "bg-muted"}`} aria-hidden />
      <span className="truncate">{status.label}</span>
    </span>
  );
}

/** Minimum width (px) per column; the table only scrolls sideways once these no longer fit. */
const COLUMN_MIN_WIDTH: Record<AssetColumnId, number> = {
  club: 140,
  name: 160,
  model: 110,
  serial: 110,
  status: 140,
  location: 100,
  updated: 92,
  manufacturer: 110,
  source: 80,
  tags: 140,
  template: 140,
  specs: 160,
  publicIp: 110,
  region: 120,
  purchase: 92,
  warranty: 96,
  reason: 140,
  added: 92,
};
const ACTIONS_WIDTH = 92;

function renderCell(id: AssetColumnId, a: AssetRow) {
  switch (id) {
    case "club":
      return <Truncated value={a.club?.name} />;
    case "name":
      return <span className="block truncate font-medium text-ink" data-tip={a.assetName}>{a.assetName}</span>;
    case "model":
      return <Truncated value={displayAssetModel(a)} />;
    case "serial":
      return <Truncated value={a.serialNumber} mono />;
    case "status":
      return <StatusBadge status={a.status} />;
    case "location": {
      const loc = assetLocation(a);
      if (!loc) return <Truncated value={null} />;
      return (
        <span className={`block truncate ${loc.kind === "geo" ? "text-muted" : ""}`} data-tip={`${loc.text} – ${loc.tip}`}>
          {loc.text}
        </span>
      );
    }
    case "updated":
      return <span className="whitespace-nowrap">{formatDate(a.dateUpdated)}</span>;
    case "manufacturer":
      return <Truncated value={displayAssetManufacturer(a)} />;
    case "source":
      return a.dataSource === "zoho_assist" ? (
        <span className="rounded bg-brand-muted px-1.5 py-0.5 text-xs font-semibold text-hna-green-text">Assist</span>
      ) : (
        <span className="text-xs">Manual</span>
      );
    case "tags":
      return <AssetTagChips tags={a.tags} category={a.category} size="xs" />;
    case "template":
      return <Truncated value={a.deviceTemplate ? displayDeviceTemplateLabel(a.deviceTemplate) : null} />;
    case "specs":
      return <Truncated value={[a.processorName, a.systemRam, a.systemGpu].filter(Boolean).join(" · ")} />;
    case "publicIp":
      return <Truncated value={a.publicIp} mono />;
    case "region": {
      const geo = formatGeoLabel(a.geoCountryCode, a.geoRegionCode, a.geoCity, a.geoRegionName);
      return <Truncated value={geo === DASH ? null : geo} />;
    }
    case "purchase":
      return <span className="whitespace-nowrap">{formatDate(a.purchaseDate)}</span>;
    case "warranty":
      return <span className="whitespace-nowrap">{formatDate(a.warrantyEndDate)}</span>;
    case "reason":
      return <Truncated value={a.reason} />;
    case "added":
      return <span className="whitespace-nowrap">{formatDate(a.dateAdded)}</span>;
  }
}

export function AssetsView({ params, assets, total, loadError, statuses, clubs, initialColumns }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const openAssetId = searchParams.get("asset");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelVersion, setPanelVersion] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<AssetRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [assistImportOpen, setAssistImportOpen] = useState(false);
  const [columns, setColumns] = useState<AssetColumnId[]>(initialColumns);
  const [search, setSearch] = useState(params.q);
  const lastRowFocus = useRef<HTMLElement | null>(null);
  const cellTip = useCellTooltip();

  // The view the user last asked for. Every change builds on it (not on the last server
  // render), so quick successive clicks and the debounced search never undo each other.
  const [pendingView, setPendingView] = useState<AssetListParams | null>(null);
  const pendingRef = useRef<AssetListParams | null>(null);
  const [seenParams, setSeenParams] = useState(params);
  if (seenParams !== params) {
    setSeenParams(params);
    if (!pendingView || assetListSearch(pendingView) === assetListSearch(params) || !isPending) {
      setPendingView(null);
      // Navigation from elsewhere (e.g. top-bar search) brings its own query.
      if (!pendingView) setSearch(params.q);
    }
  }
  useEffect(() => {
    if (!pendingView) pendingRef.current = null;
  }, [pendingView]);
  const view = pendingView ?? params;

  const navigate = useCallback(
    (patch: Partial<AssetListParams>) => {
      const next: AssetListParams = { ...(pendingRef.current ?? params), page: 1, ...patch };
      pendingRef.current = next;
      setPendingView(next);
      const sp = new URLSearchParams(assetListSearch(next));
      if (openAssetId) sp.set("asset", openAssetId);
      const qs = sp.toString();
      const url = `/assets${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", url);
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    },
    [params, openAssetId, router]
  );

  // Debounced server-side search.
  useEffect(() => {
    if (search.trim() === view.q.trim()) return;
    const t = window.setTimeout(() => navigate({ q: search }), 300);
    return () => window.clearTimeout(t);
  }, [search, view.q, navigate]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const onCreated = () => refresh();
    window.addEventListener(HARDWARE_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(HARDWARE_CREATED_EVENT, onCreated);
  }, [refresh]);

  /** Panel open/close only touches the URL (no server round trip), so the list and its scroll stay put. */
  const setPanelAsset = useCallback((id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("asset", id);
    else url.searchParams.delete("asset");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  const openPanel = useCallback(
    (id: string, from?: HTMLElement | null) => {
      lastRowFocus.current = from ?? (document.activeElement as HTMLElement | null);
      setPanelAsset(id);
    },
    [setPanelAsset]
  );

  const closePanel = useCallback(() => {
    setPanelAsset(null);
    lastRowFocus.current?.focus({ preventScroll: true });
  }, [setPanelAsset]);

  const saveColumns = useCallback(
    (next: AssetColumnId[]) => {
      setColumns(next);
      void fetch("/api/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: ASSET_COLUMNS_PREFERENCE_KEY, value: next }),
      })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => toast.showError("Column choice not saved — it will reset next visit."));
    },
    [toast]
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.showError(typeof j.error === "string" ? j.error : "Delete failed");
        return;
      }
      if (openAssetId === pendingDelete.id) setPanelAsset(null);
      setPendingDelete(null);
      toast.showSuccess("Asset deleted.");
      refresh();
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, openAssetId, setPanelAsset, refresh, toast]);

  const visible = useMemo(
    () => ASSET_COLUMNS.filter((c) => columns.includes(c.id)),
    [columns]
  );
  const tableMinWidth = visible.reduce((sum, c) => sum + COLUMN_MIN_WIDTH[c.id], ACTIONS_WIDTH);

  const pageCount = Math.max(1, Math.ceil(total / view.pageSize));
  const firstRow = total === 0 ? 0 : (view.page - 1) * view.pageSize + 1;
  const lastRow = Math.min(total, view.page * view.pageSize);
  const filtersActive = Boolean(view.q || view.status || view.club || view.source || view.missing);
  const exportHref = `/api/assets/export${assetListSearch({ ...view, page: 1 })}`;

  const toggleSort = (key: SortKey) => {
    if (view.sort === key) navigate({ sort: key, dir: view.dir === "asc" ? "desc" : "asc", page: view.page });
    else navigate({ sort: key, dir: key === "updated" || key === "added" ? "desc" : "asc" });
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="All assets"
        description="Every unit in one searchable table."
        help="Click a row for full details, history and Zoho links. Sort, filter and page are kept in the address bar, so you can bookmark or share a view."
        actions={
          <>
            <button type="button" onClick={() => setAssistImportOpen(true)} className="btn-secondary">
              Import from Zoho Assist
            </button>
            <button type="button" onClick={() => openAddHardware()} className="btn-primary">
              <Plus className="h-5 w-5" aria-hidden />
              Add hardware
            </button>
          </>
        }
      />

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
          {loadError}
        </div>
      ) : null}

      <div className="section-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="block min-w-0 flex-1 lg:min-w-[14rem]">
            <span className="text-xs font-semibold text-muted">Search</span>
            <input
              type="search"
              enterKeyHint="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, club, serial, model, location, IP…"
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ring-brand/30 focus:border-brand/50 focus:ring-2"
              autoComplete="off"
              aria-label="Search all assets"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap">
            <label className="block lg:w-44">
              <span className="text-xs font-semibold text-muted">Status</span>
              <select
                value={view.status}
                onChange={(e) => navigate({ status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value={AVAILABLE_STATUS_PARAM}>Available (New + Refurbished)</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block lg:w-44">
              <span className="text-xs font-semibold text-muted">Club</span>
              <select
                value={view.club}
                onChange={(e) => navigate({ club: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
              >
                <option value="">All clubs</option>
                <option value={NO_CLUB_PARAM}>No club</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block lg:w-36">
              <span className="text-xs font-semibold text-muted">Source</span>
              <select
                value={view.source}
                onChange={(e) => navigate({ source: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
              >
                <option value="">Any source</option>
                <option value="manual">Manual</option>
                <option value="zoho_assist">Zoho Assist</option>
              </select>
            </label>
            <label className="block lg:w-52">
              <span className="text-xs font-semibold text-muted">Missing</span>
              <select
                value={view.missing}
                onChange={(e) => navigate({ missing: e.target.value as AssetListParams["missing"] })}
                className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-2 text-sm"
              >
                <option value="">Anything</option>
                {Object.entries(MISSING_FILTERS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-xs text-muted">
          <span aria-live="polite">
            {total === 0 ? (
              "No assets"
            ) : (
              <>
                Showing <strong className="tabular-nums text-ink">{firstRow}–{lastRow}</strong> of{" "}
                <strong className="tabular-nums text-ink">{total}</strong>
                {filtersActive ? " matching" : ""}
              </>
            )}
            {isPending ? <span className="ml-2">Loading…</span> : null}
          </span>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                navigate({ q: "", status: "", club: "", source: "", missing: "" });
              }}
              className="font-semibold text-brand-deep hover:underline"
            >
              Clear filters
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <ColumnPicker
              columns={columns}
              onChange={saveColumns}
              onReset={() => saveColumns(DEFAULT_ASSET_COLUMNS)}
            />
            <a href={exportHref} className="btn-secondary" download title={`Download all ${total} matching assets`}>
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </a>
          </div>
        </div>

        <div
          className={`max-h-[calc(100dvh-17rem)] min-h-[16rem] overflow-auto border-t border-line transition-opacity ${isPending ? "opacity-60" : ""}`}
          onScroll={cellTip.hide}
        >
          <table className="w-full table-fixed text-sm" style={{ minWidth: tableMinWidth }}>
            <colgroup>
              {visible.map((c) => (
                <col key={c.id} style={{ width: COLUMN_MIN_WIDTH[c.id] }} />
              ))}
              <col style={{ width: ACTIONS_WIDTH }} />
            </colgroup>
            <thead>
              <tr>
                {visible.map((c) => {
                  const active = view.sort === c.id;
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={active ? (view.dir === "asc" ? "ascending" : "descending") : undefined}
                      className="sticky top-0 z-10 border-b border-line bg-white px-3 py-2 text-left text-xs font-semibold text-muted"
                    >
                      {c.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.id as SortKey)}
                          className={`inline-flex max-w-full items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
                        >
                          <span className="truncate">{c.label}</span>
                          {active ? (
                            view.dir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            )
                          ) : null}
                        </button>
                      ) : (
                        <span className="block truncate">{c.label}</span>
                      )}
                    </th>
                  );
                })}
                <th
                  scope="col"
                  className="sticky top-0 right-0 z-20 border-b border-l border-line bg-white px-3 py-2 text-right text-xs font-semibold text-muted"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody
              onMouseOver={(e) => cellTip.show(e.target)}
              onMouseLeave={cellTip.hide}
              onFocus={(e) => cellTip.show(e.target instanceof HTMLElement ? e.target.querySelector("[data-tip]") : null)}
              onBlur={cellTip.hide}
            >
              {assets.map((a) => {
                const selected = openAssetId === a.id;
                return (
                  <tr
                    key={a.id}
                    onClick={(e) => openPanel(a.id, e.currentTarget.querySelector("button"))}
                    className={`group cursor-pointer border-b border-line ${selected ? "bg-brand-muted/60" : "hover:bg-black/[0.025]"}`}
                  >
                    {visible.map((c, i) => (
                      <td key={c.id} className="px-3 py-2 align-middle text-ink">
                        {i === 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPanel(a.id, e.currentTarget);
                            }}
                            className="block w-full min-w-0 text-left focus-visible:outline-2 focus-visible:outline-brand"
                            aria-label={`Open details for ${a.assetName}`}
                          >
                            {renderCell(c.id, a)}
                          </button>
                        ) : (
                          renderCell(c.id, a)
                        )}
                      </td>
                    ))}
                    <td
                      className={`sticky right-0 border-l border-line px-2 py-1.5 text-right ${selected ? "bg-brand-muted" : "bg-white group-hover:bg-[#fafafa]"}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(a.id)}
                          className="rounded px-1.5 py-1 text-xs font-semibold text-brand-deep hover:bg-black/[0.04] hover:underline"
                        >
                          Edit
                        </button>
                        <OverflowMenu
                          label={a.assetName}
                          items={[
                            { label: "View details", onSelect: () => openPanel(a.id) },
                            { label: "Delete", destructive: true, onSelect: () => setPendingDelete(a) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {assets.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={visible.length + 1} className="px-4 py-12 text-center text-sm text-muted">
                    {filtersActive ? "No assets match these filters." : "No assets yet. Use Add hardware to register one."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-xs text-muted">
            Rows per page
            <select
              value={view.pageSize}
              onChange={(e) => navigate({ pageSize: Number(e.target.value) as PageSize })}
              className="rounded-md border border-line bg-white px-2 py-1 text-sm text-ink"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <nav className="flex items-center gap-1" aria-label="Pagination">
            <button
              type="button"
              onClick={() => navigate({ page: view.page - 1 })}
              disabled={view.page <= 1}
              className="btn-secondary px-2 py-1 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="px-2 text-xs text-muted tabular-nums">
              Page <strong className="text-ink">{view.page}</strong> of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => navigate({ page: view.page + 1 })}
              disabled={view.page >= pageCount}
              className="btn-secondary px-2 py-1 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </nav>
        </div>
      </div>

      <details className="rounded-lg border border-line bg-white px-4 py-3 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-ink">Lifecycle states</summary>
        <ul className="mt-2 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <li key={s.id}>
              <StatusBadge status={s} />
            </li>
          ))}
        </ul>
      </details>

      {openAssetId ? (
        <AssetDetailPanel
          key={`${openAssetId}:${panelVersion}`}
          assetId={openAssetId}
          statuses={statuses}
          suspendEsc={editingId !== null || pendingDelete !== null}
          onClose={closePanel}
          onEdit={() => setEditingId(openAssetId)}
          onChanged={refresh}
        />
      ) : null}

      {editingId ? (
        <EditAssetModal
          key={editingId}
          assetId={editingId}
          statuses={statuses}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            setPanelVersion((v) => v + 1);
            refresh();
          }}
        />
      ) : null}

      <ImportAssistAssetModal
        open={assistImportOpen}
        onClose={() => setAssistImportOpen(false)}
        onImported={() => refresh()}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete asset?"
        itemName={pendingDelete?.assetName ?? ""}
        itemDetail={pendingDelete?.serialNumber ? `S/N ${pendingDelete.serialNumber}` : "No serial number"}
        consequence="This removes the asset from the register. It cannot be undone."
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      {cellTip.node}
    </main>
  );
}
