import { describe, expect, it } from "vitest";
import {
  findTemplateReviewItems,
  normaliseManufacturer,
  type TemplateForReview,
} from "./template-duplicates";

function t(id: string, manufacturer: string, model: string, assetCount = 0): TemplateForReview {
  return { id, label: `${manufacturer} ${model}`, manufacturer, model, assetCount };
}

describe("normaliseManufacturer", () => {
  it("treats corporate suffixes and trademarks as the same maker", () => {
    expect(normaliseManufacturer("Dell Inc.")).toBe("dell");
    expect(normaliseManufacturer("Intel(R) Client Systems")).toBe("intel");
    expect(normaliseManufacturer("Hewlett-Packard")).toBe("hp");
    expect(normaliseManufacturer("MECER")).toBe("mecer");
  });
});

describe("findTemplateReviewItems", () => {
  const templates = [
    t("d1", "Dell", "OptiPlex 3050"),
    t("d2", "Dell Inc.", "OptiPlex 3050 AIO", 15),
    t("n1", "Intel", "NUC7CJYH"),
    t("n2", "Intel(R) Client Systems", "NUC7CJYH", 16),
    t("e1", "empty", "empty"),
    t("p1", "Posiflex", "PS-3316E"),
  ];

  it("flags Dell vs Dell Inc. as one maker spelled two ways", () => {
    const dell = findTemplateReviewItems(templates).find(
      (f) => f.kind === "manufacturer" && f.key.includes(":dell:")
    );
    expect(dell?.kind === "manufacturer" && dell.spellings.map((s) => s.manufacturer)).toEqual([
      "Dell Inc.",
      "Dell",
    ]);
  });

  it("flags NUC7CJYH listed twice, busiest template first", () => {
    const nuc = findTemplateReviewItems(templates).find((f) => f.kind === "template");
    expect(nuc?.kind === "template" && nuc.templates.map((x) => x.id)).toEqual(["n2", "n1"]);
  });

  it("flags the empty placeholder and keeps it out of the duplicate groups", () => {
    const findings = findTemplateReviewItems(templates);
    expect(findings.filter((f) => f.kind === "placeholder").map((f) => f.key)).toEqual([
      "placeholder:e1",
    ]);
    expect(findings.some((f) => f.key.includes(":empty:"))).toBe(false);
  });

  it("hides items an admin chose to keep", () => {
    const all = findTemplateReviewItems(templates);
    const kept = new Set(all.map((f) => f.key));
    expect(findTemplateReviewItems(templates, kept)).toEqual([]);
  });
});
