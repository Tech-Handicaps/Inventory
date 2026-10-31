import { describe, expect, it } from "vitest";
import {
  EMPTY_BOARD_FILTERS,
  NO_CLUB,
  boardFilterOptions,
  matchesBoardFilters,
  type BoardFilterAsset,
} from "./board-filters";

function asset(overrides: Partial<BoardFilterAsset> = {}): BoardFilterAsset {
  return {
    assetName: "POS 1",
    serialNumber: "SN1",
    category: "Hardware",
    tags: ["Hardware"],
    manufacturer: "Dell Inc.",
    model: "OptiPlex 3080",
    deviceTemplate: null,
    club: { id: "c1", name: "Royal Cape" },
    deviceLocation: null,
    reason: null,
    zohoAssistDeviceId: null,
    dataSource: "manual",
    publicIp: null,
    geoCountryCode: null,
    geoRegionCode: null,
    geoRegionName: null,
    geoCity: null,
    processorName: null,
    systemRam: null,
    systemGpu: null,
    status: { label: "Deployed", code: "deployed" },
    purchaseDate: "2025-01-01T00:00:00.000Z",
    warrantyEndDate: null,
    ...overrides,
  };
}

describe("matchesBoardFilters", () => {
  it("matches everything with empty filters", () => {
    expect(matchesBoardFilters(asset(), EMPTY_BOARD_FILTERS)).toBe(true);
  });

  it("filters by club, including assets with no club", () => {
    expect(matchesBoardFilters(asset(), { ...EMPTY_BOARD_FILTERS, club: "c1" })).toBe(true);
    expect(matchesBoardFilters(asset(), { ...EMPTY_BOARD_FILTERS, club: "c2" })).toBe(false);
    expect(matchesBoardFilters(asset(), { ...EMPTY_BOARD_FILTERS, club: NO_CLUB })).toBe(false);
    expect(
      matchesBoardFilters(asset({ club: null }), { ...EMPTY_BOARD_FILTERS, club: NO_CLUB })
    ).toBe(true);
  });

  it("treats manufacturer spellings as one", () => {
    const f = { ...EMPTY_BOARD_FILTERS, manufacturer: "dell" };
    expect(matchesBoardFilters(asset({ manufacturer: "Dell" }), f)).toBe(true);
    expect(matchesBoardFilters(asset({ manufacturer: "Dell Inc." }), f)).toBe(true);
    expect(matchesBoardFilters(asset({ manufacturer: "HP" }), f)).toBe(false);
  });

  it("filters by type", () => {
    const reader = asset({ category: "USB HID Magnetic Stripe Reader", tags: [] });
    expect(matchesBoardFilters(reader, { ...EMPTY_BOARD_FILTERS, type: "usb_hid_msr" })).toBe(true);
    expect(matchesBoardFilters(reader, { ...EMPTY_BOARD_FILTERS, type: "hardware" })).toBe(false);
  });

  it("combines missing-data toggles with AND", () => {
    const f = { ...EMPTY_BOARD_FILTERS, missing: ["warranty" as const] };
    expect(matchesBoardFilters(asset(), f)).toBe(true);
    expect(matchesBoardFilters(asset({ warrantyEndDate: "2027-01-01" }), f)).toBe(false);
    const both = { ...EMPTY_BOARD_FILTERS, missing: ["warranty" as const, "purchase" as const] };
    expect(matchesBoardFilters(asset(), both)).toBe(false);
    expect(matchesBoardFilters(asset({ purchaseDate: null }), both)).toBe(true);
  });

  it("combines club and search", () => {
    const f = { ...EMPTY_BOARD_FILTERS, club: "c1", search: "sn1" };
    expect(matchesBoardFilters(asset(), f)).toBe(true);
    expect(matchesBoardFilters(asset({ serialNumber: "XYZ" }), f)).toBe(false);
  });
});

describe("boardFilterOptions", () => {
  it("groups manufacturer spellings under the most common label", () => {
    const opts = boardFilterOptions(
      [asset({ manufacturer: "Dell" }), asset({ manufacturer: "Dell" }), asset()],
      EMPTY_BOARD_FILTERS
    );
    expect(opts.manufacturers).toEqual([{ value: "dell", label: "Dell", count: 3 }]);
  });

  it("narrows models to the chosen manufacturer", () => {
    const opts = boardFilterOptions(
      [asset(), asset({ manufacturer: "HP", model: "ProDesk 400" })],
      { ...EMPTY_BOARD_FILTERS, manufacturer: "hp" }
    );
    expect(opts.models.map((m) => m.label)).toEqual(["ProDesk 400"]);
  });
});
