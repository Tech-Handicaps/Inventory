import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  classifyReportAssetType,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";

// GET /api/reports/stock - Stock on hand report
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    /**
     * "Available to distribute" KPI breakdown for Dashboard.
     * We split by report asset type so card readers (USB HID MSR) can be tracked
     * separately from computers/terminals (Hardware).
     */
    const availableStatusCodes: string[] = ["new_stock", "refurbished"];
    const [byStatus, statuses, availableAssets] = await Promise.all([
      prisma.asset.groupBy({
        by: ["statusId"],
        _count: { id: true },
      }),
      prisma.assetStatus.findMany(),
      prisma.asset.findMany({
        where: { status: { code: { in: availableStatusCodes } } },
        select: {
          category: true,
          tags: true,
          status: { select: { code: true } },
        },
      }),
    ]);
    const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));

    const stock = byStatus.map((s) => ({
      statusId: s.statusId,
      status: statusMap[s.statusId]?.label ?? "Unknown",
      code: statusMap[s.statusId]?.code ?? "unknown",
      count: s._count.id,
    }));

    const total = stock.reduce((acc, s) => acc + s.count, 0);

    const makeBucket = () => ({
      new_stock: 0,
      refurbished: 0,
      total: 0,
    });

    const byType: Record<
      ReportAssetTypeId,
      ReturnType<typeof makeBucket>
    > = {
      hardware: makeBucket(),
      usb_hid_msr: makeBucket(),
      other: makeBucket(),
    };

    for (const a of availableAssets) {
      const code = a.status?.code;
      if (code !== "new_stock" && code !== "refurbished") continue;
      const typeId = classifyReportAssetType(a.category, a.tags);
      if (code === "new_stock") byType[typeId].new_stock += 1;
      if (code === "refurbished") byType[typeId].refurbished += 1;
      byType[typeId].total += 1;
    }

    const available = {
      all: {
        new_stock:
          byType.hardware.new_stock +
          byType.usb_hid_msr.new_stock +
          byType.other.new_stock,
        refurbished:
          byType.hardware.refurbished +
          byType.usb_hid_msr.refurbished +
          byType.other.refurbished,
        total: byType.hardware.total + byType.usb_hid_msr.total + byType.other.total,
      },
      hardware: byType.hardware,
      usb_hid_msr: byType.usb_hid_msr,
      other: byType.other,
    };

    return NextResponse.json({ stock, total, available });
  } catch (error) {
    console.error("GET /api/reports/stock", error);
    return NextResponse.json(
      { error: "Failed to generate stock report" },
      { status: 500 }
    );
  }
}
