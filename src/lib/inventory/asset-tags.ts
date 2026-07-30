import { ASSET_TAG_CATALOG } from "@/lib/inventory/asset-tag-catalog";

/** Normalize and dedupe tags (case-insensitive uniqueness, preserve first casing). */
export function dedupeTags(tags: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Tags for UI — falls back to legacy single `category` when tags array is empty. */
export function assetTagsForDisplay(
  tags: string[] | null | undefined,
  category: string | null | undefined
): string[] {
  const normalized = dedupeTags(tags ?? []);
  if (normalized.length > 0) return normalized;
  const c = category?.trim();
  return c ? [c] : [];
}

/** Primary category string (first tag) for legacy columns and PDFs. */
export function primaryCategoryFromTags(tags: string[]): string {
  return tags[0]?.trim() ?? "";
}

export function resolveTagsForSave(input: {
  tags?: string[] | null;
  category?: string | null;
}): { tags: string[]; category: string } {
  let tags = dedupeTags(input.tags ?? []);
  if (tags.length === 0 && input.category?.trim()) {
    tags = [input.category.trim()];
  }
  const category = primaryCategoryFromTags(tags);
  return { tags, category };
}

export function parseTagsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return dedupeTags(value.filter((t): t is string => typeof t === "string"));
}

export function mergeTagSuggestions(
  catalog: string[],
  fromDatabase: string[]
): string[] {
  return dedupeTags([...catalog, ...fromDatabase]).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export const DEFAULT_TAG_SUGGESTIONS = ASSET_TAG_CATALOG;
