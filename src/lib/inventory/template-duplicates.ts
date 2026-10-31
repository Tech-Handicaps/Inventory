/**
 * Finds device templates that look like the same thing typed differently.
 * Detection only: every merge or removal is chosen by an admin in Settings.
 */

export type TemplateForReview = {
  id: string;
  label: string;
  manufacturer: string;
  model: string;
  assetCount: number;
};

export type ManufacturerSpellingFinding = {
  kind: "manufacturer";
  key: string;
  spellings: { manufacturer: string; templateCount: number; assetCount: number }[];
};

export type TemplateDuplicateFinding = {
  kind: "template";
  key: string;
  templates: TemplateForReview[];
};

export type PlaceholderTemplateFinding = {
  kind: "placeholder";
  key: string;
  template: TemplateForReview;
};

export type TemplateReviewFinding =
  | ManufacturerSpellingFinding
  | TemplateDuplicateFinding
  | PlaceholderTemplateFinding;

export const DUPLICATE_KEPT_ACTION = "device_template.duplicate_kept";

const MANUFACTURER_ALIASES: Record<string, string> = {
  "hewlett packard": "hp",
};

const CORPORATE_SUFFIXES = new Set([
  "inc",
  "ltd",
  "co",
  "corp",
  "corporation",
  "international",
  "client",
  "systems",
]);

const PLACEHOLDER_VALUES = new Set(["", "empty", "n/a", "na", "none", "null", "unknown", "-", "test"]);

export function normaliseManufacturer(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/\((r|tm|c)\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !CORPORATE_SUFFIXES.has(word));
  const joined = words.join(" ");
  return MANUFACTURER_ALIASES[joined] ?? joined;
}

export function normaliseModel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+]+/g, "");
}

export function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

export function manufacturerFindingKey(normalised: string, spellings: string[]): string {
  return `manufacturer:${normalised}:${[...spellings].sort().join("|")}`;
}

export function templateFindingKey(ids: string[]): string {
  return `template:${[...ids].sort().join("|")}`;
}

export function placeholderFindingKey(id: string): string {
  return `placeholder:${id}`;
}

export function findTemplateReviewItems(
  templates: TemplateForReview[],
  dismissedKeys: ReadonlySet<string> = new Set()
): TemplateReviewFinding[] {
  const findings: TemplateReviewFinding[] = [];

  for (const template of templates) {
    if (isPlaceholderValue(template.manufacturer) || isPlaceholderValue(template.model)) {
      findings.push({
        kind: "placeholder",
        key: placeholderFindingKey(template.id),
        template,
      });
    }
  }

  const realTemplates = templates.filter(
    (t) => !isPlaceholderValue(t.manufacturer) && !isPlaceholderValue(t.model)
  );

  const byManufacturer = new Map<string, TemplateForReview[]>();
  for (const template of realTemplates) {
    const key = normaliseManufacturer(template.manufacturer);
    if (!key) continue;
    byManufacturer.set(key, [...(byManufacturer.get(key) ?? []), template]);
  }
  for (const [normalised, group] of byManufacturer) {
    const spellings = [...new Set(group.map((t) => t.manufacturer))];
    if (spellings.length < 2) continue;
    findings.push({
      kind: "manufacturer",
      key: manufacturerFindingKey(normalised, spellings),
      spellings: spellings
        .map((manufacturer) => {
          const matching = group.filter((t) => t.manufacturer === manufacturer);
          return {
            manufacturer,
            templateCount: matching.length,
            assetCount: matching.reduce((sum, t) => sum + t.assetCount, 0),
          };
        })
        .sort((a, b) => b.assetCount - a.assetCount || a.manufacturer.localeCompare(b.manufacturer)),
    });
  }

  const byModel = new Map<string, TemplateForReview[]>();
  for (const template of realTemplates) {
    const key = `${normaliseManufacturer(template.manufacturer)}::${normaliseModel(template.model)}`;
    byModel.set(key, [...(byModel.get(key) ?? []), template]);
  }
  for (const group of byModel.values()) {
    if (group.length < 2) continue;
    findings.push({
      kind: "template",
      key: templateFindingKey(group.map((t) => t.id)),
      templates: [...group].sort(
        (a, b) => b.assetCount - a.assetCount || a.label.localeCompare(b.label)
      ),
    });
  }

  return findings.filter((finding) => !dismissedKeys.has(finding.key));
}
