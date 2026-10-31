import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  NO_CLUB_PARAM,
  statusCodesFromParam,
  type AssetListParams,
  type SortKey,
} from "@/lib/inventory/asset-table";

const assetInclude = { status: true, deviceTemplate: true, club: true } satisfies Prisma.AssetInclude;

export type AssetWithRelations = Prisma.AssetGetPayload<{ include: typeof assetInclude }>;
export type OpenAssessmentBrief = { id: string; referenceNumber: string; workflowStatus: string };
export type ListedAsset = AssetWithRelations & { assessments: OpenAssessmentBrief[] };

type OpenAssessmentRow = OpenAssessmentBrief & { assetId: string };

/** Latest open assessment per asset; empty when the table is missing so lists still load. */
async function openAssessmentsFor(assetIds: string[] | "all"): Promise<Map<string, OpenAssessmentBrief>> {
  if (assetIds !== "all" && assetIds.length === 0) return new Map();
  const filter =
    assetIds === "all" ? Prisma.empty : Prisma.sql`AND "assetId" IN (${Prisma.join(assetIds)})`;
  const rows = await prisma
    .$queryRaw<OpenAssessmentRow[]>(
      Prisma.sql`
        SELECT DISTINCT ON ("assetId") id, "assetId", "referenceNumber", "workflowStatus"
        FROM "Assessment"
        WHERE "workflowStatus" = 'open' ${filter}
        ORDER BY "assetId", "createdAt" DESC
      `
    )
    .catch((e) => {
      console.warn("asset-query: could not load open assessments; continuing without.", e);
      return [] as OpenAssessmentRow[];
    });
  return new Map(
    rows.map((r) => [r.assetId, { id: r.id, referenceNumber: r.referenceNumber, workflowStatus: r.workflowStatus }])
  );
}

function withAssessments(rows: AssetWithRelations[], open: Map<string, OpenAssessmentBrief>): ListedAsset[] {
  return rows.map((a) => {
    const one = open.get(a.id);
    return { ...a, assessments: one ? [one] : [] };
  });
}

/** Legacy list used by GET /api/assets and the board: simple equality filters, newest first. */
export async function listAssetsSimple(opts: {
  where?: Prisma.AssetWhereInput;
  limit: number;
  offset?: number;
}): Promise<{ assets: ListedAsset[]; total: number }> {
  const where = opts.where ?? {};
  const [rows, total, open] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: assetInclude,
      orderBy: { dateUpdated: "desc" },
      take: opts.limit,
      skip: opts.offset ?? 0,
    }),
    prisma.asset.count({ where }),
    openAssessmentsFor("all"),
  ]);
  return { assets: withAssessments(rows, open), total };
}

export function buildAssetWhere(params: AssetListParams): Prisma.AssetWhereInput {
  const and: Prisma.AssetWhereInput[] = [];
  const statusCodes = statusCodesFromParam(params.status);
  if (statusCodes.length === 1) and.push({ status: { code: statusCodes[0] } });
  else if (statusCodes.length > 1) and.push({ status: { code: { in: statusCodes } } });
  if (params.club === NO_CLUB_PARAM) and.push({ clubId: null });
  else if (params.club) and.push({ clubId: params.club });
  if (params.source) and.push({ dataSource: params.source });
  const q = params.q.trim();
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    and.push({
      OR: [
        { assetName: contains },
        { serialNumber: contains },
        { manufacturer: contains },
        { model: contains },
        { deviceLocation: contains },
        { category: contains },
        { tags: { has: q } },
        { publicIp: contains },
        { reason: contains },
        { zohoAssistDeviceId: contains },
        { club: { name: contains } },
        { deviceTemplate: { label: contains } },
        { status: { label: contains } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

function orderByFor(sort: SortKey, dir: "asc" | "desc"): Prisma.AssetOrderByWithRelationInput[] {
  const nullsLast = (field: string) => ({ [field]: { sort: dir, nulls: "last" } });
  const primary: Prisma.AssetOrderByWithRelationInput = (() => {
    switch (sort) {
      case "club":
        return { club: { name: dir } };
      case "name":
        return { assetName: dir };
      case "model":
        return nullsLast("model");
      case "serial":
        return nullsLast("serialNumber");
      case "status":
        return { status: { sortOrder: dir } };
      case "location":
        return nullsLast("deviceLocation");
      case "manufacturer":
        return nullsLast("manufacturer");
      case "source":
        return { dataSource: dir };
      case "publicIp":
        return nullsLast("publicIp");
      case "purchase":
        return nullsLast("purchaseDate");
      case "warranty":
        return nullsLast("warrantyEndDate");
      case "added":
        return { dateAdded: dir };
      case "updated":
      default:
        return { dateUpdated: dir };
    }
  })() as Prisma.AssetOrderByWithRelationInput;
  // Stable paging when many rows share the sort value.
  return [primary, { id: "asc" }];
}

/** Server-side paged, sorted and filtered list for All assets. */
export async function listAssetsPage(params: AssetListParams): Promise<{
  assets: ListedAsset[];
  total: number;
  page: number;
}> {
  const where = buildAssetWhere(params);
  const fetchPage = (page: number) =>
    prisma.asset.findMany({
      where,
      include: assetInclude,
      orderBy: orderByFor(params.sort, params.dir),
      take: params.pageSize,
      skip: (page - 1) * params.pageSize,
    });
  const [total, firstTry] = await Promise.all([prisma.asset.count({ where }), fetchPage(params.page)]);
  const lastPage = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, lastPage);
  const rows = page === params.page ? firstTry : await fetchPage(page);
  const open = await openAssessmentsFor(rows.map((r) => r.id));
  return { assets: withAssessments(rows, open), total, page };
}

/** Every row matching the filters (CSV export), in the chosen sort order. */
export async function listAllMatchingAssets(params: AssetListParams): Promise<AssetWithRelations[]> {
  return prisma.asset.findMany({
    where: buildAssetWhere(params),
    include: assetInclude,
    orderBy: orderByFor(params.sort, params.dir),
    take: 10_000,
  });
}

/** Turns Dates into ISO strings so server-loaded rows match the JSON the API returns. */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
