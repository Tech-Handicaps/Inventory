import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/reports/finance-packs
 * Official stored finance months, with file hashes and the send history.
 * Manual tests are not stored and appear only in the send history.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const [packs, logs] = await Promise.all([
      prisma.financeMonthPack.findMany({
        orderBy: { monthKey: "desc" },
        include: { _count: { select: { lines: true } } },
      }),
      prisma.financePackSendLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return NextResponse.json(
      {
        months: packs.map((pack) => ({
          monthKey: pack.monthKey,
          monthLabel: pack.monthLabel,
          monthEndingLabel: pack.monthEndingLabel,
          sentAt: pack.recipientCount > 0 ? pack.sentAt.toISOString() : null,
          recipientCount: pack.recipientCount,
          recipients: pack.recipients,
          generatedBy: pack.generatedBy,
          hasCsv: Boolean(pack.csvStoragePath),
          fileHashes: (pack.fileHashes ?? {}) as Record<string, string>,
          newStock: pack.newStock,
          refurbished: pack.refurbished,
          usable: pack.usable,
          deployed: pack.deployed,
          assessment: pack.assessment,
          inRepair: pack.inRepair,
          writtenOff: pack.writtenOff,
          register: pack.register,
          modelCount: pack._count.lines,
        })),
        sendLog: logs.map((log) => ({
          id: log.id,
          monthKey: log.monthKey,
          mode: log.mode,
          status: log.status,
          reason: log.reason,
          sent: log.sent,
          failed: log.failed,
          recipients: log.recipients,
          error: log.error,
          createdAt: log.createdAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/reports/finance-packs", error);
    return NextResponse.json({ error: "Failed to load official finance packs" }, { status: 500 });
  }
}
