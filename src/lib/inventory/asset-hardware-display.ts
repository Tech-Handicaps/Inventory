import { normalizeAssistHardwareValue } from "@/lib/inventory/assist-hardware-values";

type AssetHardwareFields = {
  manufacturer: string | null;
  model: string | null;
  deviceTemplate?: {
    manufacturer?: string | null;
    model?: string | null;
  } | null;
};

export function displayAssetManufacturer(
  asset: AssetHardwareFields
): string | null {
  return (
    normalizeAssistHardwareValue(asset.manufacturer) ??
    normalizeAssistHardwareValue(asset.deviceTemplate?.manufacturer) ??
    null
  );
}

export function displayAssetModel(asset: AssetHardwareFields): string | null {
  return (
    normalizeAssistHardwareValue(asset.model) ??
    normalizeAssistHardwareValue(asset.deviceTemplate?.model) ??
    null
  );
}
