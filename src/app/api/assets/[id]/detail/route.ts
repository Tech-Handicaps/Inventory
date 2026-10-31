import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { zohoAssistConsoleUrl, zohoDeskTicketUrl } from "@/lib/zoho/web-links";

const HISTORY_LIMIT = 50;

// GET /api/assets/:id/detail — everything the All assets side panel shows.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const [asset, history, assistSettings, deskSettings] = await Promise.all([
      prisma.asset.findUnique({
        where: { id },
        include: {
          status: true,
          deviceTemplate: true,
          club: true,
          assessments: { orderBy: { createdAt: "desc" } },
          repairs: { orderBy: { createdAt: "desc" } },
          dispatchVouchers: {
            orderBy: { dispatchedAt: "desc" },
            select: { id: true, referenceNumber: true, fromStatusCode: true, clubName: true, dispatchedAt: true },
          },
          writeOffCertificates: {
            orderBy: { writtenOffAt: "desc" },
            select: { id: true, referenceNumber: true, reason: true, writtenOffAt: true },
          },
        },
      }),
      prisma.auditLog.findMany({
        where: { metadata: { path: ["assetId"], equals: id } },
        orderBy: { timestamp: "desc" },
        take: HISTORY_LIMIT,
        select: { id: true, actionType: true, userId: true, timestamp: true, notes: true },
      }),
      prisma.zohoAssistSettings.findUnique({ where: { id: "singleton" }, select: { dataCenter: true } }),
      prisma.zohoDeskSettings.findUnique({ where: { id: "singleton" }, select: { dataCenter: true } }),
    ]);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const userIds = [...new Set(history.map((h) => h.userId).filter((u): u is string => !!u))];
    const profiles = userIds.length
      ? await prisma.userProfile.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, firstName: true, lastName: true, username: true },
        })
      : [];
    const nameById = new Map(
      profiles.map((p) => [p.userId, [p.firstName, p.lastName].filter(Boolean).join(" ") || p.username])
    );

    const deskDc = deskSettings?.dataCenter ?? process.env.ZOHO_DESK_DATA_CENTER ?? "us";
    const deskLink = (ticketId: string | null) => (ticketId ? zohoDeskTicketUrl(deskDc, ticketId) : null);

    return NextResponse.json({
      asset: {
        ...asset,
        assessments: asset.assessments.map((a) => ({ ...a, zohoDeskUrl: deskLink(a.zohoDeskTicketId) })),
        repairs: asset.repairs.map((r) => ({ ...r, zohoDeskUrl: deskLink(r.zohoDeskTicketId) })),
      },
      history: history.map((h) => ({
        ...h,
        actor: h.userId ? (nameById.get(h.userId) ?? null) : null,
      })),
      historyLimit: HISTORY_LIMIT,
      links: {
        zohoAssistConsole: asset.zohoAssistDeviceId
          ? zohoAssistConsoleUrl(assistSettings?.dataCenter ?? process.env.ZOHO_DATA_CENTER)
          : null,
      },
    });
  } catch (error) {
    console.error("GET /api/assets/[id]/detail", error);
    return NextResponse.json({ error: "Failed to load asset detail" }, { status: 500 });
  }
}
