/**
 * All assets table: column ids, URL params and their parsing. Client-safe (no Prisma).
 */

export const ASSET_COLUMNS = [
  { id: "club", label: "Club", sortable: true, default: true },
  { id: "name", label: "Name", sortable: true, default: true },
  { id: "model", label: "Model", sortable: true, default: true },
  { id: "serial", label: "Serial", sortable: true, default: true },
  { id: "status", label: "Status", sortable: true, default: true },
  { id: "location", label: "Location", sortable: true, default: true },
  { id: "updated", label: "Updated", sortable: true, default: true },
  { id: "manufacturer", label: "Manufacturer", sortable: true, default: false },
  { id: "source", label: "Source", sortable: true, default: false },
  { id: "tags", label: "Tags", sortable: false, default: false },
  { id: "template", label: "Template", sortable: false, default: false },
  { id: "specs", label: "CPU / RAM / GPU", sortable: false, default: false },
  { id: "publicIp", label: "Public IP", sortable: true, default: false },
  { id: "region", label: "Region (GeoIP)", sortable: false, default: false },
  { id: "purchase", label: "Purchase", sortable: true, default: false },
  { id: "warranty", label: "Warranty end", sortable: true, default: false },
  { id: "reason", label: "Reason", sortable: false, default: false },
  { id: "added", label: "Added", sortable: true, default: false },
] as const;

export type AssetColumnId = (typeof ASSET_COLUMNS)[number]["id"];

export const DEFAULT_ASSET_COLUMNS: AssetColumnId[] = ASSET_COLUMNS.filter((c) => c.default).map(
  (c) => c.id
);

export const ASSET_COLUMNS_PREFERENCE_KEY = "assets.columns";

const COLUMN_IDS = new Set<string>(ASSET_COLUMNS.map((c) => c.id));

/** Keeps known ids in table order; falls back to the defaults when nothing valid is left. */
export function sanitizeColumns(value: unknown): AssetColumnId[] {
  if (!Array.isArray(value)) return DEFAULT_ASSET_COLUMNS;
  const wanted = new Set(value.filter((v): v is string => typeof v === "string" && COLUMN_IDS.has(v)));
  const cols = ASSET_COLUMNS.filter((c) => wanted.has(c.id)).map((c) => c.id);
  return cols.length > 0 ? cols : DEFAULT_ASSET_COLUMNS;
}

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type SortKey = Extract<(typeof ASSET_COLUMNS)[number], { sortable: true }>["id"];
const SORT_KEYS = new Set<string>(ASSET_COLUMNS.filter((c) => c.sortable).map((c) => c.id));

export const NO_CLUB_PARAM = "none";

/** Status filter value for stock ready to deploy (matches the Dashboard "Available" KPI). */
export const AVAILABLE_STATUS_PARAM = "new_stock,refurbished";

/** Status codes for a status param ("" = all; comma-separated = any of them). */
export function statusCodesFromParam(status: string): string[] {
  return status
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Missing" filter values: units without this detail (geo also leaves out written-off units). */
export const MISSING_FILTERS = {
  purchase: "No purchase date",
  warranty: "No warranty end date",
  serial: "No serial number",
  geo: "No location from IP (in use)",
} as const;
export type MissingFilter = keyof typeof MISSING_FILTERS;

export type AssetListParams = {
  page: number;
  pageSize: PageSize;
  sort: SortKey;
  dir: "asc" | "desc";
  q: string;
  /** Status code, or "" for all. */
  status: string;
  /** Club id, NO_CLUB_PARAM, or "". */
  club: string;
  /** "manual" | "zoho_assist" | "" */
  source: string;
  /** A MissingFilter key, or "". */
  missing: MissingFilter | "";
};

export const DEFAULT_LIST_PARAMS: AssetListParams = {
  page: 1,
  pageSize: 25,
  sort: "updated",
  dir: "desc",
  q: "",
  status: "",
  club: "",
  source: "",
  missing: "",
};

type ParamSource = { get(name: string): string | null };

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Accepts URLSearchParams or a Next.js `searchParams` record. */
export function parseAssetListParams(
  input: ParamSource | Record<string, string | string[] | undefined>
): AssetListParams {
  const get = (k: string) =>
    typeof (input as ParamSource).get === "function"
      ? (input as ParamSource).get(k)
      : first((input as Record<string, string | string[] | undefined>)[k]);
  const pageSizeRaw = Number(get("size"));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(pageSizeRaw)
    ? (pageSizeRaw as PageSize)
    : DEFAULT_LIST_PARAMS.pageSize;
  const sortRaw = get("sort") ?? "";
  const sort = SORT_KEYS.has(sortRaw) ? (sortRaw as SortKey) : DEFAULT_LIST_PARAMS.sort;
  const dirRaw = get("dir");
  const dir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : sort === "updated" || sort === "added" ? "desc" : "asc";
  const source = get("source") ?? "";
  const missing = get("missing") ?? "";
  return {
    page: Math.max(1, Math.floor(Number(get("page")) || 1)),
    pageSize,
    sort,
    dir,
    q: (get("q") ?? "").slice(0, 120),
    status: (get("status") ?? "").slice(0, 40),
    club: (get("club") ?? "").slice(0, 40),
    source: source === "manual" || source === "zoho_assist" ? source : "",
    missing: Object.hasOwn(MISSING_FILTERS, missing) ? (missing as MissingFilter) : "",
  };
}

/** Only non-default values go in the URL, so a plain /assets stays clean. */
export function assetListSearch(params: AssetListParams): string {
  const sp = new URLSearchParams();
  if (params.q.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.club) sp.set("club", params.club);
  if (params.source) sp.set("source", params.source);
  if (params.missing) sp.set("missing", params.missing);
  if (params.sort !== DEFAULT_LIST_PARAMS.sort || params.dir !== DEFAULT_LIST_PARAMS.dir) {
    sp.set("sort", params.sort);
    sp.set("dir", params.dir);
  }
  if (params.pageSize !== DEFAULT_LIST_PARAMS.pageSize) sp.set("size", String(params.pageSize));
  if (params.page > 1) sp.set("page", String(params.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
