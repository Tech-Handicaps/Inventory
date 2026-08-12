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
  manufacturer: string;
  model: string;
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
