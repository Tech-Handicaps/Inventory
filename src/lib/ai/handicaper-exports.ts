import { prisma } from "@/lib/prisma";
import { resolveAssetSkuModelLabel } from "@/lib/inventory/device-template-label";
import { wantsCsvExport } from "@/lib/csv/download-csv";
import { wantsStockBreakdown } from "@/lib/ai/handicaper-context";

export type AssetRegistryExportRow = {
  assetName: string;
  status: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  club: string;
  tags: string;
  dataSource: string;
  deviceLocation: string;
  dateUpdated: string;
};

export async function buildAssetRegistryExportRows(): Promise<
  AssetRegistryExportRow[]
> {
  const assets = await prisma.asset.findMany({
    select: {
      assetName: true,
      category: true,
      tags: true,
      serialNumber: true,
      manufacturer: true,
      model: true,
      dataSource: true,
      deviceLocation: true,
      dateUpdated: true,
      status: { select: { label: true } },
      club: { select: { name: true } },
    },
    orderBy: [{ status: { sortOrder: "asc" } }, { assetName: "asc" }],
  });

  return assets.map((a) => ({
    assetName: a.assetName,
    status: a.status.label,
    category: a.category,
    manufacturer: a.manufacturer ?? "",
    model: resolveAssetSkuModelLabel(a),
    serialNumber: a.serialNumber ?? "",
    club: a.club?.name ?? "",
    tags: (a.tags ?? []).join("; "),
    dataSource: a.dataSource,
    deviceLocation: a.deviceLocation ?? "",
    dateUpdated: a.dateUpdated.toISOString().slice(0, 10),
  }));
}

/** Full asset list CSV — not the in-stock model breakdown. */
export function wantsAssetRegistryExport(
  message: string,
  page?: string
): boolean {
  if (wantsStockBreakdown(message)) return false;

  const m = message.toLowerCase();
  const csvIntent =
    wantsCsvExport(message) ||
    m.includes("export") ||
    m.includes("download");

  if (!csvIntent) return false;

  if (page === "assets" && !m.includes("stock") && !m.includes("model")) {
    return true;
  }

  if (
    m.includes("all asset") ||
    m.includes("registered asset") ||
    m.includes("asset list") ||
    m.includes("asset registry") ||
    m.includes("every asset")
  ) {
    return true;
  }

  if (m.includes("asset") && !m.includes("stock") && !m.includes("model")) {
    return true;
  }

  if (m.includes("inventory") && csvIntent) {
    return true;
  }

  return false;
}

export type HandicaperExportKind = "stock" | "assets";

/** Replace hallucinated “go find an export button” replies when we attached a CSV. */
export function sanitizeHandicaperExportReply(
  reply: string,
  kind: HandicaperExportKind,
  count: number,
  displayName?: string
): string {
  const who = displayName?.trim() || "there";
  const deniesExport =
    /can't|cannot|don't have|do not have|no export|look for an export|typically near|try the reports|system admin/i.test(
      reply
    );

  if (deniesExport) {
    if (kind === "assets") {
      return `Hi ${who}! I've prepared a CSV with all ${count} registered assets from live inventory. Use **Download CSV** below${count > 0 ? " — your file may download automatically." : "."}`;
    }
    return `Hi ${who}! Here's the in-stock breakdown by model (${count} line${count === 1 ? "" : "s"}). Use **Download CSV** below.`;
  }

  if (!/download csv|csv below|csv export/i.test(reply)) {
    const hint =
      kind === "assets"
        ? `\n\nUse **Download CSV** below for all ${count} registered assets.`
        : `\n\nUse **Download CSV** below for the in-stock model breakdown.`;
    return reply + hint;
  }

  return reply;
}
