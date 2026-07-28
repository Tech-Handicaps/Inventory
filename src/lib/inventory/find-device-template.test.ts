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

import { findMatchingDeviceTemplate } from "./find-device-template";

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
