import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  classifyReportAssetType,
  reportAssetTypeLabel,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";

export const dynamic = "force-dynamic";

type BreakdownRow = {
  label: string;
  count: number;
  detail?: string;
};

type ExplainResult = {
  title: string;
  summary: string;
  breakdown: BreakdownRow[];
  note?: string;
};

const METRIC_HANDLERS: Record<
  string,
  (
    assets: {
      assetName: string;
      category: string;
      tags: string[];
      manufacturer: string | null;
      model: string | null;
      status: { code: string; label: string };
    }[]
  ) => ExplainResult
> = {
  totalRegistered: (assets) => {
    const byStatus = new Map<string, number>();
    for (const a of assets) {
      const label = a.status.label;
      byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
    }
    const breakdown = Array.from(byStatus.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));

    return {
      title: "Total Registered Assets",
      summary: `There are ${assets.length} assets in the inventory register across all lifecycle stages. Here is the breakdown by current status.`,
      breakdown,
      note: "This count includes every asset ever registered — new stock, deployed, in repair, refurbished, and written off.",
    };
  },

  computersAvailable: (assets) => {
    const matching = assets.filter(
      (a) =>
        (a.status.code === "new_stock" || a.status.code === "refurbished") &&
        classifyReportAssetType(a.category, a.tags) === "hardware"
    );
    return buildAvailableBreakdown(
      matching,
      "Terminals / Computers / AIO Available",
      "terminals, computers, AIO, POS terminals, and general IT hardware",
      "Card readers (USB HID MSR) are tracked separately and excluded from this count."
    );
  },

  cardReadersAvailable: (assets) => {
    const matching = assets.filter(
      (a) =>
        (a.status.code === "new_stock" || a.status.code === "refurbished") &&
        classifyReportAssetType(a.category, a.tags) === "usb_hid_msr"
    );
    return buildAvailableBreakdown(
      matching,
      "Card Readers Available",
      "USB HID magnetic stripe readers",
      "This count only includes card readers. Terminals and computers are tracked separately."
    );
  },

  deployed: (assets) => {
    const matching = assets.filter((a) => a.status.code === "deployed");
    return buildByTypeBreakdown(
      matching,
      "Deployed Assets",
      "currently deployed in the field at club sites"
    );
  },

  inRepair: (assets) => {
    const matching = assets.filter((a) => a.status.code === "repair");
    return buildByTypeBreakdown(
      matching,
      "Assets In Repair",
      "currently in the repair pipeline"
    );
  },

  writtenOff: (assets) => {
    const matching = assets.filter((a) => a.status.code === "written_off");
    return buildByTypeBreakdown(
      matching,
      "Written-Off Assets",
      "removed from active use and written off"
    );
  },
};

function buildAvailableBreakdown(
  assets: {
    manufacturer: string | null;
    model: string | null;
    status: { code: string };
  }[],
  title: string,
  typeDescription: string,
  note: string
): ExplainResult {
  const newStock = assets.filter((a) => a.status.code === "new_stock");
  const refurbished = assets.filter((a) => a.status.code === "refurbished");

  const byMakeModel = new Map<string, number>();
  for (const a of assets) {
    const mfg = a.manufacturer?.trim() || "";
    const mdl = a.model?.trim() || "";
    const key = [mfg, mdl].filter(Boolean).join(" ") || "Unknown";
    byMakeModel.set(key, (byMakeModel.get(key) ?? 0) + 1);
  }

  const breakdown: BreakdownRow[] = [
    { label: "New stock", count: newStock.length, detail: "ready to distribute" },
    { label: "Refurbished", count: refurbished.length, detail: "returned and reconditioned" },
    { label: "─", count: 0, detail: "" },
    ...Array.from(byMakeModel.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count, detail: "by make / model" })),
  ];

  return {
    title,
    summary: `${assets.length} unit${assets.length === 1 ? "" : "s"} of ${typeDescription} are available to distribute (${newStock.length} new stock + ${refurbished.length} refurbished).`,
    breakdown,
    note,
  };
}

function buildByTypeBreakdown(
  assets: {
    category: string;
    tags: string[];
    manufacturer: string | null;
    model: string | null;
  }[],
  title: string,
  statusDescription: string
): ExplainResult {
  const byAssetType = new Map<ReportAssetTypeId, number>();
  const byMakeModel = new Map<string, number>();

  for (const a of assets) {
    const typeId = classifyReportAssetType(a.category, a.tags);
    byAssetType.set(typeId, (byAssetType.get(typeId) ?? 0) + 1);

    const mfg = a.manufacturer?.trim() || "";
    const mdl = a.model?.trim() || "";
    const key = [mfg, mdl].filter(Boolean).join(" ") || "Unknown";
    byMakeModel.set(key, (byMakeModel.get(key) ?? 0) + 1);
  }

  const breakdown: BreakdownRow[] = [
    ...Array.from(byAssetType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([typeId, count]) => ({
        label: reportAssetTypeLabel(typeId),
        count,
        detail: "by asset type",
      })),
    { label: "─", count: 0, detail: "" },
    ...Array.from(byMakeModel.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count, detail: "by make / model" })),
  ];

  return {
    title,
    summary: `${assets.length} asset${assets.length === 1 ? "" : "s"} are ${statusDescription}. Below is a breakdown by asset type and make/model.`,
    breakdown,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: { metricKey?: string; metricLabel?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const metricKey = typeof body.metricKey === "string" ? body.metricKey.trim() : "";
  if (!metricKey) {
    return NextResponse.json({ error: "metricKey is required" }, { status: 400 });
  }

  const handler = METRIC_HANDLERS[metricKey];
  if (!handler) {
    return NextResponse.json(
      {
        error: `Unknown metric "${metricKey}". Handicaper doesn't know how to explain this one yet.`,
      },
      { status: 400 }
    );
  }

  try {
    const assets = await prisma.asset.findMany({
      select: {
        assetName: true,
        category: true,
        tags: true,
        manufacturer: true,
        model: true,
        status: { select: { code: true, label: true } },
      },
    });

    const result = handler(assets);
    return NextResponse.json(result);
  } catch (e) {
    console.error("POST /api/ai/handicaper/explain", e);
    return NextResponse.json(
      { error: "Handicaper failed to generate the breakdown" },
      { status: 500 }
    );
  }
}
