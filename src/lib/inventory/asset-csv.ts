import { formatDate } from "@/lib/dates/format";
import { formatGeoLabel } from "@/lib/geo/region-display";
import { rowsToCsv } from "@/lib/csv/download-csv";
import type { AssetWithRelations } from "@/lib/inventory/asset-query";
import {
  displayAssetManufacturer,
  displayAssetModel,
} from "@/lib/inventory/asset-hardware-display";
import { displayDeviceTemplateLabel } from "@/lib/inventory/device-template-label";

const HEADERS = [
  "Club",
  "Name",
  "Status",
  "Manufacturer",
  "Model",
  "Serial",
  "Location",
  "Source",
  "Category",
  "Tags",
  "Template",
  "CPU",
  "RAM",
  "GPU",
  "Public IP",
  "Region (GeoIP)",
  "Purchase",
  "Warranty end",
  "Reason",
  "Zoho Assist device id",
  "Added",
  "Updated",
];

/** Every exported field, independent of which columns are visible on screen. */
export function assetsToCsv(assets: AssetWithRelations[]): string {
  const rows = assets.map((a) => [
    a.club?.name ?? "",
    a.assetName,
    a.status.label,
    displayAssetManufacturer(a) ?? "",
    displayAssetModel(a) ?? "",
    a.serialNumber ?? "",
    a.deviceLocation ?? "",
    a.dataSource === "zoho_assist" ? "Zoho Assist" : "Manual",
    a.category,
    (a.tags ?? []).join("; "),
    a.deviceTemplate ? displayDeviceTemplateLabel(a.deviceTemplate) : "",
    a.processorName ?? "",
    a.systemRam ?? "",
    a.systemGpu ?? "",
    a.publicIp ?? "",
    (() => {
      const geo = formatGeoLabel(a.geoCountryCode, a.geoRegionCode, a.geoCity, a.geoRegionName);
      return geo === "—" ? "" : geo;
    })(),
    formatDate(a.purchaseDate, ""),
    formatDate(a.warrantyEndDate, ""),
    a.reason ?? "",
    a.zohoAssistDeviceId ?? "",
    formatDate(a.dateAdded, ""),
    formatDate(a.dateUpdated, ""),
  ]);
  return rowsToCsv(HEADERS, rows);
}
