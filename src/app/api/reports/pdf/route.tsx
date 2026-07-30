import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import type { PdfAssetRow } from "@/lib/pdf/inventory-report-document";
import type { PdfCatalogRow } from "@/lib/pdf/catalog-report-document";
import { loadLogoForPdf } from "@/lib/pdf/load-logo";
import { renderInventoryReportPdf } from "@/lib/pdf/render-inventory-report";
import { renderCatalogReportPdf } from "@/lib/pdf/render-catalog-report";
import { renderReconcileReportPdf } from "@/lib/pdf/render-reconcile-report";
import {
  reportAssetTypeById,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";
import {
  buildStockReconcileReport,
  filterAssetsByReportTypeAndStatus,
  stockStatusInclude,
  type StockStatusFilter,
} from "@/lib/reports/stock-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REPORT_TYPES = [
  "overall",
  "available",
  "deployed",
  "refurbished",
  "terminals_available",
  "hardware_new_stock",
  "hardware_refurbished",
  "usb_hid_msr_new_stock",
  "usb_hid_msr_refurbished",
  "reconcile",
] as const;
type ReportType = (typeof REPORT_TYPES)[number];

function isReportType(s: string | null): s is ReportType {
  return s !== null && REPORT_TYPES.includes(s as ReportType);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type AssetWithStatus = Prisma.AssetGetPayload<{
  include: typeof stockStatusInclude;
}>;

function toRows(assets: AssetWithStatus[]): PdfAssetRow[] {
  return assets.map((a) => ({
    assetName: a.assetName,
    category: a.category,
    manufacturer: a.manufacturer,
    model: a.model,
    serialNumber: a.serialNumber,
    statusLabel: a.status.label,
    dateUpdated: formatDate(a.dateUpdated),
  }));
}

type TypeStatusReport = {
  type: ReportType;
  typeId: ReportAssetTypeId;
  status: StockStatusFilter;
  filenameBase: string;
};

const TYPE_STATUS_REPORTS: Record<string, TypeStatusReport> = {
  hardware_new_stock: {
    type: "hardware_new_stock",
    typeId: "hardware",
    status: "new_stock",
    filenameBase: "hna-hardware-new-stock",
  },
  hardware_refurbished: {
    type: "hardware_refurbished",
    typeId: "hardware",
    status: "refurbished",
    filenameBase: "hna-hardware-refurbished",
  },
  usb_hid_msr_new_stock: {
    type: "usb_hid_msr_new_stock",
    typeId: "usb_hid_msr",
    status: "new_stock",
    filenameBase: "hna-usb-readers-new-stock",
  },
  usb_hid_msr_refurbished: {
    type: "usb_hid_msr_refurbished",
    typeId: "usb_hid_msr",
    status: "refurbished",
    filenameBase: "hna-usb-readers-refurbished",
  },
};

async function renderTypeStatusPdf(
  config: TypeStatusReport,
  generatedAt: string,
  logoSource: Buffer | string | null
) {
  const assetType = reportAssetTypeById(config.typeId)!;
  const statusLabel =
    config.status === "new_stock" ? "New Stock" : "Refurbished";

  const all = await prisma.asset.findMany({
    include: stockStatusInclude,
    orderBy: [{ assetName: "asc" }],
  });
  const assets = filterAssetsByReportTypeAndStatus(
    all,
    config.typeId,
    config.status
  );

  const title = `${assetType.label} — ${statusLabel}`;
  const subtitle = `Units in ${statusLabel} classified as ${assetType.label.toLowerCase()} (by category on each asset row)`;

  const buffer = await renderInventoryReportPdf({
    title,
    subtitle,
    generatedAt,
    logoSource,
    summaryRows: [
      { label: "Asset type", value: assetType.label },
      { label: "Lifecycle stage", value: statusLabel },
      { label: "Unit count", value: String(assets.length) },
    ],
    rows: toRows(assets),
  });

  return pdfResponse(buffer, config.filenameBase);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const raw = request.nextUrl.searchParams.get("type");
    const generatedAt = new Date().toLocaleString("en-ZA");
    const logoSource = await loadLogoForPdf();

    if (raw === "catalog") {
      const templates = await prisma.deviceTemplate.findMany({
        orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
      });
      const categories = new Set(templates.map((t) => t.category));
      const rows: PdfCatalogRow[] = templates.map((t) => ({
        label: t.label,
        manufacturer: t.manufacturer,
        model: t.model,
        category: t.category,
        notes: t.notes,
        updatedAt: formatDate(t.updatedAt),
      }));
      const summaryRows = [
        { label: "Catalog entries", value: String(templates.length) },
        { label: "Unique categories", value: String(categories.size) },
      ];
      const buffer = await renderCatalogReportPdf({
        title: "Device template catalog",
        subtitle:
          "Approved presets from Settings (make / model / category) — for audit of catalog only; excludes physical assets on the board",
        generatedAt,
        logoSource,
        summaryRows,
        rows,
      });
      return pdfResponse(buffer, "hna-catalog-device-templates");
    }

    if (raw === "reconcile") {
      const assets = await prisma.asset.findMany({
        include: stockStatusInclude,
      });
      const report = buildStockReconcileReport(assets);
      const monthLabel = new Date().toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "long",
      });
      const buffer = await renderReconcileReportPdf({
        title: "Monthly stock reconcile",
        subtitle: `Finance reconciliation — ${monthLabel} · stock and full register by asset type`,
        generatedAt,
        logoSource,
        report,
      });
      return pdfResponse(buffer, "hna-monthly-stock-reconcile");
    }

    if (raw && TYPE_STATUS_REPORTS[raw]) {
      return renderTypeStatusPdf(
        TYPE_STATUS_REPORTS[raw]!,
        generatedAt,
        logoSource
      );
    }

    const type = isReportType(raw) ? raw : "overall";

    const statuses = await prisma.assetStatus.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const byCode = Object.fromEntries(statuses.map((s) => [s.code, s.id]));

    const include = stockStatusInclude;

    if (type === "overall") {
      const title = "Overall inventory report";
      const subtitle =
        "All hardware by status — stakeholder & accounting snapshot";
      const assets = await prisma.asset.findMany({
        include,
        orderBy: [{ status: { sortOrder: "asc" } }, { assetName: "asc" }],
      });

      const byStatus = await prisma.asset.groupBy({
        by: ["statusId"],
        _count: { id: true },
      });
      const statusLabel = Object.fromEntries(
        statuses.map((s) => [s.id, s.label])
      );
      const summaryRows = [
        {
          label: "Total assets",
          value: String(assets.length),
        },
        ...byStatus.map((g) => ({
          label: statusLabel[g.statusId] ?? "Unknown",
          value: String(g._count.id),
        })),
      ];

      const buffer = await renderInventoryReportPdf({
        title,
        subtitle,
        generatedAt,
        logoSource,
        summaryRows,
        rows: toRows(assets),
      });

      return pdfResponse(buffer, "hna-inventory-overall");
    }

    if (type === "available") {
      const title = "Hardware available to distribute";
      const subtitle =
        "Ready to hand out — New Stock (never deployed) plus Refurbished (serviced)";
      const newId = byCode.new_stock;
      const refurbId = byCode.refurbished;
      const availableIds = [newId, refurbId].filter(
        (id): id is string => Boolean(id)
      );
      const assets = availableIds.length
        ? await prisma.asset.findMany({
            where: { statusId: { in: availableIds } },
            include,
            orderBy: [{ status: { sortOrder: "asc" } }, { assetName: "asc" }],
          })
        : [];
      const newCount = assets.filter((a) => a.statusId === newId).length;
      const refurbCount = assets.filter((a) => a.statusId === refurbId).length;
      const summaryRows = [
        { label: "Available to distribute", value: String(assets.length) },
        { label: "New stock", value: String(newCount) },
        { label: "Refurbished", value: String(refurbCount) },
      ];
      const buffer = await renderInventoryReportPdf({
        title,
        subtitle,
        generatedAt,
        logoSource,
        summaryRows,
        rows: toRows(assets),
      });
      return pdfResponse(buffer, "hna-inventory-available");
    }

    if (type === "deployed") {
      const title = "Deployed hardware — field report";
      const subtitle =
        "Assets in active deployment — total in the field and counts by category (asset type)";
      const sid = byCode.deployed;
      const assets = sid
        ? await prisma.asset.findMany({
            where: { statusId: sid },
            include,
            orderBy: [{ category: "asc" }, { assetName: "asc" }],
          })
        : [];
      const byCategory = sid
        ? await prisma.asset.groupBy({
            by: ["category"],
            where: { statusId: sid },
            _count: { id: true },
          })
        : [];
      const categorySummary = [...byCategory]
        .sort((a, b) => b._count.id - a._count.id)
        .map((g) => ({
          label: g.category?.trim() ? g.category : "Uncategorized",
          value: String(g._count.id),
        }));
      const summaryRows = [
        {
          label: "Total deployed (in the field)",
          value: String(assets.length),
        },
        {
          label: "Distinct categories (types)",
          value: String(categorySummary.length),
        },
        ...categorySummary,
      ];
      const buffer = await renderInventoryReportPdf({
        title,
        subtitle,
        generatedAt,
        logoSource,
        summaryRows,
        rows: toRows(assets),
      });
      return pdfResponse(buffer, "hna-inventory-deployed");
    }

    if (type === "refurbished") {
      const title = "Refurbished hardware";
      const subtitle = "Items ready for reuse or redistribution";
      const sid = byCode.refurbished;
      const assets = sid
        ? await prisma.asset.findMany({
            where: { statusId: sid },
            include,
            orderBy: { assetName: "asc" },
          })
        : [];
      const summaryRows = [
        { label: "Refurbished count", value: String(assets.length) },
      ];
      const buffer = await renderInventoryReportPdf({
        title,
        subtitle,
        generatedAt,
        logoSource,
        summaryRows,
        rows: toRows(assets),
      });
      return pdfResponse(buffer, "hna-inventory-refurbished");
    }

    const title = "Terminals available to distribute";
    const subtitle =
      "Available stock (New + Refurbished) where category or name suggests terminal / POS class hardware";
    const availableIds = [byCode.new_stock, byCode.refurbished].filter(
      (id): id is string => Boolean(id)
    );
    const assets = availableIds.length
      ? await prisma.asset.findMany({
          where: {
            statusId: { in: availableIds },
            OR: [
              { category: { contains: "terminal", mode: "insensitive" } },
              { category: { contains: "pos", mode: "insensitive" } },
              { category: { contains: "kiosk", mode: "insensitive" } },
              { assetName: { contains: "terminal", mode: "insensitive" } },
            ],
          },
          include,
          orderBy: [{ status: { sortOrder: "asc" } }, { assetName: "asc" }],
        })
      : [];
    const summaryRows = [
      { label: "Matching terminals available", value: String(assets.length) },
    ];
    const buffer = await renderInventoryReportPdf({
      title,
      subtitle,
      generatedAt,
      logoSource,
      summaryRows,
      rows: toRows(assets),
    });
    return pdfResponse(buffer, "hna-inventory-terminals-available");
  } catch (error) {
    console.error("GET /api/reports/pdf", error);
    return NextResponse.json(
      { error: "Failed to generate PDF report" },
      { status: 500 }
    );
  }
}

function pdfResponse(buffer: Buffer, filenameBase: string) {
  const safe = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "no-store",
    },
  });
}
