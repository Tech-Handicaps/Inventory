import { describe, expect, it } from "vitest";
import { summariseOverview, type OverviewAsset } from "@/lib/reports/dashboard-overview-summary";

const NOW = new Date("2026-10-31T12:00:00Z");
const STATUSES = [
  { code: "new_stock", label: "New Stock" },
  { code: "deployed", label: "Deployed" },
  { code: "repair", label: "In Repairs" },
  { code: "refurbished", label: "Refurbished" },
  { code: "written_off", label: "Written Off" },
];

function asset(over: Partial<OverviewAsset>): OverviewAsset {
  return {
    statusCode: "deployed",
    brand: "Dell",
    model: "OptiPlex 3050",
    type: "hardware",
    category: "Hardware",
    dataSource: "zoho_assist",
    hasSerial: true,
    location: "My Department",
    hasClub: true,
    hasGeo: false,
    dateAdded: new Date("2026-05-01T00:00:00Z"),
    purchaseDate: null,
    warrantyEndDate: null,
    ...over,
  };
}

describe("summariseOverview", () => {
  const assets = [
    asset({}),
    asset({ brand: "Lenovo", model: "10Q0S0CU00", hasGeo: true }),
    asset({ statusCode: "new_stock", type: "usb_hid_msr", brand: "Gigatek", model: "MSR250HK", hasClub: false }),
    asset({ statusCode: "refurbished", brand: "Unknown", model: null, location: "Durban", hasClub: false }),
    asset({ statusCode: "written_off", purchaseDate: new Date("2020-10-31T12:00:00Z") }),
    asset({ hasClub: false, warrantyEndDate: new Date("2026-12-01T00:00:00Z"), purchaseDate: new Date("2024-10-31T12:00:00Z") }),
  ];
  const o = summariseOverview(assets, STATUSES, NOW, "Unknown");

  it("counts stages and KPIs that reconcile with the total", () => {
    expect(o.total).toBe(6);
    expect(o.stages.reduce((s, x) => s + x.count, 0)).toBe(6);
    expect(o.kpis).toMatchObject({ deployed: 3, available: 2, inRepair: 0, writtenOff: 1 });
    expect(o.kpis.availableByType).toEqual({ hardware: 1, usb_hid_msr: 1, other: 0 });
  });

  it("puts every unit in one manufacturer slice, Unknown last", () => {
    expect(o.manufacturers.reduce((s, m) => s + m.count, 0)).toBe(o.total);
    expect(o.manufacturers[0]).toEqual({ name: "Dell", count: 3 });
    expect(o.manufacturers.at(-1)?.name).toBe("Unknown");
  });

  it("ranks models and skips units without one", () => {
    expect(o.topSkus[0]).toEqual({ brand: "Dell", model: "OptiPlex 3050", count: 3 });
    expect(o.distinctModels).toBe(3);
  });

  it("flags low-coverage stats", () => {
    expect(o.operational).toBe(5);
    expect(o.averageAgeYears).toMatchObject({ basedOn: 1, of: 5, lowCoverage: true });
    expect(o.averageAgeYears.value).toBeCloseTo(2, 1);
    expect(o.warrantyExpiring90Days).toMatchObject({ value: 1, basedOn: 1, lowCoverage: true });
  });

  it("treats the Assist default location as missing", () => {
    const location = o.dataQuality.find((d) => d.key === "location");
    expect(location).toMatchObject({ have: 1, of: 6 });
    const club = o.dataQuality.find((d) => d.key === "club");
    expect(club).toMatchObject({ have: 2, of: 3, missingHref: "/assets?status=deployed&club=none" });
  });

  it("counts approximate GeoIP locations over units in use, separately from confirmed clubs", () => {
    const geo = o.dataQuality.find((d) => d.key === "geo");
    expect(geo).toMatchObject({ have: 1, of: 5, missingHref: "/assets?missing=geo" });
    expect(geo?.label).toMatch(/approximate/);
  });

  it("uses plain stage labels that match the KPI cards", () => {
    expect(o.stages.find((s) => s.code === "repair")?.label).toBe("In repair");
    expect(o.stages.find((s) => s.code === "new_stock")?.label).toBe("New stock");
  });

  it("builds the Fleet model list from the same grouping, split in use / written off", () => {
    expect(o.fleet.models.length).toBe(o.distinctModels);
    expect(o.fleet.models[0]).toEqual({ brand: "Dell", model: "OptiPlex 3050", inUse: 2, writtenOff: 1, total: 3 });
    expect(o.fleet.noModel).toEqual({ inUse: 1, writtenOff: 0 });
    expect(o.fleet).toMatchObject({ inUse: 5, writtenOff: 1, brandsInUse: 3 });
    expect(o.fleet.warranty).toEqual({ active: 1, expiring90: 1, expired: 0 });
  });
});
