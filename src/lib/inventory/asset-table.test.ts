import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSET_COLUMNS,
  DEFAULT_LIST_PARAMS,
  assetListSearch,
  parseAssetListParams,
  sanitizeColumns,
} from "@/lib/inventory/asset-table";

describe("parseAssetListParams", () => {
  it("returns defaults for an empty query", () => {
    expect(parseAssetListParams(new URLSearchParams())).toEqual(DEFAULT_LIST_PARAMS);
  });

  it("reads valid values from URLSearchParams and Next searchParams records", () => {
    const fromUrl = parseAssetListParams(
      new URLSearchParams("q=lenovo&status=deployed&club=none&source=zoho_assist&missing=warranty&sort=serial&dir=desc&size=100&page=3")
    );
    expect(fromUrl).toEqual({
      page: 3,
      pageSize: 100,
      sort: "serial",
      dir: "desc",
      q: "lenovo",
      status: "deployed",
      club: "none",
      source: "zoho_assist",
      missing: "warranty",
    });
    expect(parseAssetListParams({ size: ["50", "100"], sort: "name" })).toMatchObject({
      pageSize: 50,
      sort: "name",
      dir: "asc",
    });
  });

  it("ignores unknown sort keys, page sizes and sources", () => {
    expect(
      parseAssetListParams(new URLSearchParams("sort=tags&size=30&source=excel&missing=club&page=-2"))
    ).toMatchObject({ sort: "updated", dir: "desc", pageSize: 25, source: "", missing: "", page: 1 });
  });
});

describe("assetListSearch", () => {
  it("keeps the default view out of the URL", () => {
    expect(assetListSearch(DEFAULT_LIST_PARAMS)).toBe("");
  });

  it("round-trips through parseAssetListParams", () => {
    const params = { ...DEFAULT_LIST_PARAMS, sort: "updated" as const, dir: "asc" as const, pageSize: 100 as const, page: 2, q: "hp" };
    const search = assetListSearch(params);
    expect(search).toBe("?q=hp&sort=updated&dir=asc&size=100&page=2");
    expect(parseAssetListParams(new URLSearchParams(search))).toEqual(params);
  });
});

describe("sanitizeColumns", () => {
  it("keeps known ids in table order", () => {
    expect(sanitizeColumns(["manufacturer", "bogus", "club", 4])).toEqual(["club", "manufacturer"]);
  });

  it("falls back to the defaults", () => {
    expect(sanitizeColumns(null)).toEqual(DEFAULT_ASSET_COLUMNS);
    expect(sanitizeColumns(["bogus"])).toEqual(DEFAULT_ASSET_COLUMNS);
  });
});
