import type { DeviceTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyAlias, type AliasMap } from "@/lib/inventory/model-aliases";

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Resolve a device template for Zoho Assist (or manual) imports.
 *
 * 1. Exact manufacturer + model (case-insensitive) when both are present.
 * 2. Model-only when Assist omits manufacturer — only when exactly one template
 *    shares that model (avoids ambiguous matches across brands).
 * 3. If manufacturer + model fail but model matches one row after narrowing by
 *    manufacturer, use that row.
 */
export async function findMatchingDeviceTemplate(
  manufacturer: string | null | undefined,
  model: string | null | undefined
): Promise<DeviceTemplate | null> {
  const mfg = trimOrNull(manufacturer);
  const mdl = trimOrNull(model);

  if (mfg && mdl) {
    const exact = await prisma.deviceTemplate.findFirst({
      where: {
        manufacturer: { equals: mfg, mode: "insensitive" },
        model: { equals: mdl, mode: "insensitive" },
      },
    });
    if (exact) return exact;
  }

  if (!mdl) return null;

  const byModel = await prisma.deviceTemplate.findMany({
    where: { model: { equals: mdl, mode: "insensitive" } },
    orderBy: [{ manufacturer: "asc" }, { label: "asc" }],
  });

  if (byModel.length === 1) return byModel[0]!;

  if (byModel.length > 1 && mfg) {
    const narrowed = byModel.filter(
      (t) => t.manufacturer.trim().toLowerCase() === mfg.toLowerCase()
    );
    if (narrowed.length === 1) return narrowed[0]!;
  }

  return null;
}

/**
 * {@link findMatchingDeviceTemplate}, then again with the admin alias table applied (e.g. Assist reports the
 * motherboard name "MS-A95311" for an MSI AP190). `viaAlias` tells the caller to store the template's names.
 */
export async function findDeviceTemplateWithAliases(
  manufacturer: string | null | undefined,
  model: string | null | undefined,
  aliases: AliasMap
): Promise<{ template: DeviceTemplate | null; viaAlias: boolean }> {
  const direct = await findMatchingDeviceTemplate(manufacturer, model);
  if (direct) return { template: direct, viaAlias: false };
  const mfg = applyAlias(aliases, "manufacturer", manufacturer);
  const mdl = applyAlias(aliases, "model", model);
  if (mfg === trimOrNull(manufacturer) && mdl === trimOrNull(model)) return { template: null, viaAlias: false };
  const aliased = await findMatchingDeviceTemplate(mfg, mdl);
  return { template: aliased, viaAlias: Boolean(aliased) };
}
