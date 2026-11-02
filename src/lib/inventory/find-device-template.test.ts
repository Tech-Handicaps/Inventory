import { describe, expect, it, beforeEach, vi } from "vitest";

const { findFirst, findMany } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deviceTemplate: {
      findFirst,
      findMany,
    },
  },
}));

import { buildAliasMap } from "./model-aliases";
import { findDeviceTemplateWithAliases, findMatchingDeviceTemplate } from "./find-device-template";

const posiflexTemplate = {
  id: "tpl-posiflex",
  label: "Posiflex Terminal",
  manufacturer: "Posiflex",
  model: "PS-3316",
  category: "Terminal",
  notes: null,
  processorName: null,
  systemRam: null,
  systemGpu: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("findMatchingDeviceTemplate", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
  });

  it("matches on manufacturer and model when both are present", async () => {
    findFirst.mockResolvedValue(posiflexTemplate);
    findMany.mockResolvedValue([]);

    const result = await findMatchingDeviceTemplate("Posiflex", "PS-3316");

    expect(result).toEqual(posiflexTemplate);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        manufacturer: { equals: "Posiflex", mode: "insensitive" },
        model: { equals: "PS-3316", mode: "insensitive" },
      },
    });
  });

  it("falls back to model-only when manufacturer is missing from Assist", async () => {
    findMany.mockResolvedValue([posiflexTemplate]);

    const result = await findMatchingDeviceTemplate(null, "PS-3316");

    expect(result).toEqual(posiflexTemplate);
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith({
      where: { model: { equals: "PS-3316", mode: "insensitive" } },
      orderBy: [{ manufacturer: "asc" }, { label: "asc" }],
    });
  });

  it("falls back to unique model match when manufacturer from Assist does not match", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([posiflexTemplate]);

    const result = await findMatchingDeviceTemplate("Unknown", "PS-3316");

    expect(result).toEqual(posiflexTemplate);
  });

  it("returns null when model is missing", async () => {
    const result = await findMatchingDeviceTemplate("Posiflex", "");

    expect(result).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns null when multiple templates share the same model and manufacturer cannot narrow", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([
      posiflexTemplate,
      { ...posiflexTemplate, id: "tpl-other", manufacturer: "Other" },
    ]);

    const result = await findMatchingDeviceTemplate(null, "PS-3316");

    expect(result).toBeNull();
  });
});

describe("findDeviceTemplateWithAliases", () => {
  const msi = { ...posiflexTemplate, id: "tpl-msi", label: "MSI AP190", manufacturer: "MSI", model: "AP190" };
  const aliases = buildAliasMap([
    { kind: "model", alias: "MS-A95311", canonical: "AP190" },
    { kind: "manufacturer", alias: "MICRO-STAR INTERNATIONAL CO., LTD", canonical: "MSI" },
  ]);

  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
  });

  it("maps the motherboard name Assist reports to the MSI AP190 template", async () => {
    findFirst.mockImplementation(async ({ where }) => (where.model.equals === "AP190" ? msi : null));
    findMany.mockImplementation(async ({ where }) => (where.model.equals === "AP190" ? [msi] : []));

    const result = await findDeviceTemplateWithAliases("MICRO-STAR INTERNATIONAL CO., LTD", "MS-A95311", aliases);

    expect(result).toEqual({ template: msi, viaAlias: true });
  });

  it("prefers a direct match and does not retry when no alias applies", async () => {
    findFirst.mockResolvedValue(posiflexTemplate);
    expect(await findDeviceTemplateWithAliases("Posiflex", "PS-3316", aliases)).toEqual({
      template: posiflexTemplate,
      viaAlias: false,
    });

    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    expect(await findDeviceTemplateWithAliases("Acme", "Z1", aliases)).toEqual({ template: null, viaAlias: false });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});
