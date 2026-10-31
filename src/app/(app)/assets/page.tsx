import { requireOperationalSession } from "@/lib/auth/get-session-role";
import { listAssetsPage, toPlain } from "@/lib/inventory/asset-query";
import {
  ASSET_COLUMNS_PREFERENCE_KEY,
  parseAssetListParams,
  sanitizeColumns,
} from "@/lib/inventory/asset-table";
import { getUserPreference } from "@/lib/preferences/user-preferences";
import { prisma } from "@/lib/prisma";
import { AssetsView, type AssetRow } from "./assets-client";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireOperationalSession();
  const params = parseAssetListParams(await searchParams);

  const [list, statuses, clubs, columnsPref] = await Promise.all([
    listAssetsPage(params).catch((e) => {
      console.error("AssetsPage: list failed", e);
      return null;
    }),
    prisma.assetStatus
      .findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, label: true } })
      .catch(() => []),
    prisma.club.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }).catch(() => []),
    getUserPreference(session.userId, ASSET_COLUMNS_PREFERENCE_KEY),
  ]);

  return (
    <AssetsView
      params={{ ...params, page: list?.page ?? params.page }}
      assets={list ? (toPlain(list.assets) as unknown as AssetRow[]) : []}
      total={list?.total ?? 0}
      loadError={list ? null : "Could not load assets. Refresh to try again."}
      statuses={statuses}
      clubs={clubs}
      initialColumns={sanitizeColumns(columnsPref)}
    />
  );
}
