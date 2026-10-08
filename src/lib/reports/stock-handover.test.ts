import { describe, expect, it } from "vitest";
import { LEGACY_STOCK_SKUS } from "@/lib/reports/legacy-month-end-catalog";
import { buildStockHandover } from "@/lib/reports/stock-handover";

const handover = buildStockHandover();
const text = [
  ...handover.paragraphs,
  ...handover.events.map((event) => `${event.dateLabel} ${event.statement}`),
  ...handover.outcomes.flatMap((outcome) => [
    outcome.title,
    outcome.statement,
    ...outcome.lines.flatMap((line) => [line.name, line.note]),
  ]),
].join(" ");

describe("stock handover", () => {
  it("states the series end, the copies, and the system dates", () => {
    expect(text).toContain("ends on 31 December 2025");
    expect(text).toContain("January, February, and March 2026 repeat that December take");
    expect(text).toContain("They are copies");
    expect(text).toContain("April 2026 is not a copy of December");
    expect(text).toContain("first asset on 18 April 2026");
    expect(text).toContain("still being loaded through 13 August 2026");
    expect(text).toContain("Their totals are not added together");
  });

  it("lists each copy month and keeps the two series apart", () => {
    const copies = handover.events.filter((event) =>
      event.statement.startsWith("Copy of the 31 December 2025 take")
    );
    expect(copies.map((event) => event.dateLabel)).toEqual([
      "31 January 2026",
      "28 February 2026",
      "31 March 2026",
    ]);
    expect(copies.every((event) => event.series === "Prior company")).toBe(true);

    const system = handover.events.filter((event) => event.series === "This system");
    expect(system.map((event) => event.dateLabel)).toEqual([
      "18 April 2026",
      "13 August 2026",
    ]);
    expect(text).not.toMatch(/\b\d{2,}\b units/);
  });

  it("sorts every workbook line into named or quantity-only, and keeps Assist-only rows apart", () => {
    const named = handover.outcomes.find((outcome) => outcome.id === "named_on_both_sides");
    const quantity = handover.outcomes.find((outcome) => outcome.id === "quantity_only");
    const register = handover.outcomes.find((outcome) => outcome.id === "register_only");
    if (!named || !quantity || !register) throw new Error("missing outcome");

    const namedKeys = named.lines.flatMap((line) => line.skuKeys);
    const quantityKeys = quantity.lines.flatMap((line) => line.skuKeys);
    expect(namedKeys).toEqual(
      expect.arrayContaining([
        "posiflex-ps-3316e",
        "dell-optiplex-7440",
        "hp-compaq-8300",
      ])
    );
    expect(quantityKeys).toEqual(
      expect.arrayContaining([
        "mecer-card-reader-bracket",
        "mecer-ust-tp01",
        "vodafone-k3565-rev-2",
      ])
    );
    expect([...namedKeys, ...quantityKeys].sort()).toEqual(
      LEGACY_STOCK_SKUS.map((sku) => sku.key).sort()
    );
    expect(register.lines.every((line) => line.skuKeys.length === 0)).toBe(true);
    expect(text).toContain("Posiflex PS-3316E");
    expect(text).toContain("Dell OptiPlex");
    expect(text).toContain("HP Compaq 8300");
    expect(text).toContain("Wi-Fi dongle");
    expect(text).toContain("USB modems");
    expect(text).toContain("Zoho Assist field units start in this system");
    expect(text).toContain("A matching name is not a matching quantity");
  });
});
