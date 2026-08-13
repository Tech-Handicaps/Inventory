/** Catalog label: manufacturer + model (not asset/deployment names). */
export function buildDeviceTemplateLabel(
  manufacturer: string | null | undefined,
  model: string | null | undefined
): string {
  return [manufacturer, model]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function displayDeviceTemplateLabel(template: {
  label?: string | null;
  manufacturer?: string | null;
  model?: string | null;
}): string {
  return (
    buildDeviceTemplateLabel(template.manufacturer, template.model) ||
    template.label?.trim() ||
    "—"
  );
}

export function withDerivedDeviceTemplateLabel<
  T extends { label: string; manufacturer: string; model: string },
>(template: T): T {
  const derived = buildDeviceTemplateLabel(
    template.manufacturer,
    template.model
  );
  return derived ? { ...template, label: derived } : template;
}

/** SKU / model label for fleet reports — never asset deployment names. */
export function resolveAssetSkuModelLabel(asset: {
  manufacturer: string | null;
  model: string | null;
  deviceTemplate?: { manufacturer: string; model: string } | null;
}): string {
  const manufacturer = (
    asset.manufacturer ??
    asset.deviceTemplate?.manufacturer ??
    ""
  ).trim();
  const model = (asset.model ?? asset.deviceTemplate?.model ?? "").trim();
  return buildDeviceTemplateLabel(manufacturer, model) || "Unknown";
}
