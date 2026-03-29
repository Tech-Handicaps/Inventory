import { readFileSync, existsSync } from "fs";
import path from "path";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import type { PdfAssetRow } from "@/lib/pdf/inventory-report-document";
import { renderInventoryReportPdf } from "@/lib/pdf/render-inventory-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORT_TYPES = [
  "overall",
  "in_stock",
  "refurbished",
  "terminals_in_stock",
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
  include: { status: true };
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

function loadLogoDataUri(): string | null {
  const logoPath = path.join(
    process.cwd(),
    "public",
    "brand",
    "hna-logo.png"
  );
  if (!existsSync(logoPath)) return null;
  try {
    const buf = readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const raw = request.nextUrl.searchParams.get("type");
    const type = isReportType(raw) ? raw : "overall";

    const statuses = await prisma.assetStatus.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const byCode = Object.fromEntries(statuses.map((s) => [s.code, s.id]));

    const include = { status: true as const };
    const generatedAt = new Date().toLocaleString("en-ZA");
    const logoDataUri = loadLogoDataUri();

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
        logoDataUri,
        summaryRows,
        rows: toRows(assets),
      });

      return pdfResponse(buffer, "hna-inventory-overall");
    }

    if (type === "in_stock") {
      const title = "Hardware in stock";
      const subtitle =
        "Items currently marked In stock — available for deployment";
      const sid = byCode.in_stock;
      const assets = sid
        ? await prisma.asset.findMany({
            where: { statusId: sid },
            include,
            orderBy: { assetName: "asc" },
          })
        : [];
      const summaryRows = [
        { label: "In stock count", value: String(assets.length) },
      ];
      const buffer = await renderInventoryReportPdf({
        title,
        subtitle,
        generatedAt,
        logoDataUri,
        summaryRows,
        rows: toRows(assets),
      });
      return pdfResponse(buffer, "hna-inventory-in-stock");
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
        logoDataUri,
        summaryRows,
        rows: toRows(assets),
      });
      return pdfResponse(buffer, "hna-inventory-refurbished");
    }

    const title = "Terminals in stock";
    const subtitle =
      "In-stock items where category or name suggests terminal / POS class hardware";
    const sid = byCode.in_stock;
    const assets = sid
      ? await prisma.asset.findMany({
          where: {
            statusId: sid,
            OR: [
              { category: { contains: "terminal", mode: "insensitive" } },
              { category: { contains: "pos", mode: "insensitive" } },
              { category: { contains: "kiosk", mode: "insensitive" } },
              { assetName: { contains: "terminal", mode: "insensitive" } },
            ],
          },
          include,
          orderBy: { assetName: "asc" },
        })
      : [];
    const summaryRows = [
      { label: "Matching terminals in stock", value: String(assets.length) },
    ];
    const buffer = await renderInventoryReportPdf({
      title,
      subtitle,
      generatedAt,
      logoDataUri,
      summaryRows,
      rows: toRows(assets),
    });
    return pdfResponse(buffer, "hna-inventory-terminals-in-stock");
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
