import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const MODEL_ALIASES_TAG = "model-aliases";

export type AliasKind = "model" | "manufacturer";

export type AliasMap = {
  model: Record<string, string>;
  manufacturer: Record<string, string>;
};

export const EMPTY_ALIASES: AliasMap = { model: {}, manufacturer: {} };

function key(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Lenovo M810z and Lenovo 10Q0 are different models and must never be merged. */
export function breaksLenovoRule(alias: string, canonical: string): boolean {
  const isM810z = (v: string) => /m810z/i.test(v);
  const is10q0 = (v: string) => /10q0/i.test(v);
  return (isM810z(alias) && is10q0(canonical)) || (is10q0(alias) && isM810z(canonical));
}

export function buildAliasMap(rows: { kind: string; alias: string; canonical: string }[]): AliasMap {
  const map: AliasMap = { model: {}, manufacturer: {} };
  for (const row of rows) {
    if (row.kind !== "model" && row.kind !== "manufacturer") continue;
    if (breaksLenovoRule(row.alias, row.canonical)) continue;
    map[row.kind][key(row.alias)] = row.canonical.trim();
  }
  return map;
}

/** The name the reports use for this spelling, or the input unchanged. */
export function applyAlias(map: AliasMap, kind: AliasKind, value: string | null | undefined): string | null {
  if (!value?.trim()) return value?.trim() || null;
  return map[kind][key(value)] ?? value.trim();
}

const cached = unstable_cache(
  async (): Promise<AliasMap> => {
    const rows = await prisma.modelAlias.findMany({ select: { kind: true, alias: true, canonical: true } });
    return buildAliasMap(rows);
  },
  ["model-aliases-v1"],
  { tags: [MODEL_ALIASES_TAG], revalidate: 3600 }
);

export async function loadAliasMap(): Promise<AliasMap> {
  try {
    return await cached();
  } catch (error) {
    console.error("loadAliasMap", error);
    return EMPTY_ALIASES;
  }
}

export function invalidateModelAliases() {
  try {
    revalidateTag(MODEL_ALIASES_TAG, { expire: 0 });
  } catch {
    /* outside a request */
  }
}
