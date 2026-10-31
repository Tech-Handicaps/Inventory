import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

const LIMIT = 8;

export type GlobalSearchHit = {
  id: string;
  assetName: string;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  clubName: string | null;
  statusLabel: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) return auth;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const contains = { contains: q, mode: "insensitive" as const };
  try {
    const rows = await prisma.asset.findMany({
      where: {
        OR: [
          { serialNumber: contains },
          { assetName: contains },
          { model: contains },
          { manufacturer: contains },
          { club: { name: contains } },
          { deviceTemplate: { label: contains } },
        ],
      },
      select: {
        id: true,
        assetName: true,
        serialNumber: true,
        model: true,
        manufacturer: true,
        club: { select: { name: true } },
        status: { select: { label: true } },
      },
      orderBy: { dateUpdated: "desc" },
      take: 50,
    });

    const needle = q.toLowerCase();
    const rank = (r: (typeof rows)[number]) => {
      if (r.serialNumber?.toLowerCase() === needle) return 0;
      if (r.serialNumber?.toLowerCase().startsWith(needle)) return 1;
      if (r.assetName.toLowerCase().startsWith(needle)) return 2;
      return 3;
    };
    const hits: GlobalSearchHit[] = rows
      .map((r, i) => ({ r, i, score: rank(r) }))
      .sort((a, b) => a.score - b.score || a.i - b.i)
      .slice(0, LIMIT)
      .map(({ r }) => ({
        id: r.id,
        assetName: r.assetName,
        serialNumber: r.serialNumber,
        model: r.model,
        manufacturer: r.manufacturer,
        clubName: r.club?.name ?? null,
        statusLabel: r.status.label,
      }));
    return NextResponse.json({ hits });
  } catch (error) {
    console.error("GET /api/search", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
