import { InventoryBoard } from "./board-client";
import type { BoardAsset, BoardStatus } from "@/components/board/types";
import { requireOperationalSession } from "@/lib/auth/get-session-role";
import { listAssetsSimple, toPlain } from "@/lib/inventory/asset-query";
import { prisma } from "@/lib/prisma";

/** Loads the board on the server so the first paint already has cards (no client fetch chain). */
export default async function InventoryPage() {
  await requireOperationalSession();
  const data = await Promise.all([
    listAssetsSimple({ limit: 1000 }),
    prisma.assetStatus.findMany({ orderBy: { sortOrder: "asc" } }),
  ]).catch((e) => {
    console.error("inventory page: server load failed; the board will load in the browser", e);
    return null;
  });

  return (
    <InventoryBoard
      initialAssets={data ? (toPlain(data[0].assets) as unknown as BoardAsset[]) : null}
      initialStatuses={data ? (toPlain(data[1]) as unknown as BoardStatus[]) : null}
    />
  );
}
