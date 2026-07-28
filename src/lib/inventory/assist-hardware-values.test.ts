import { describe, expect, it } from "vitest";
import {
  normalizeAssistHardwareValue,
  resolveHardwareFieldFromAssistAndTemplate,
} from "./assist-hardware-values";

describe("normalizeAssistHardwareValue", () => {
  it("returns undefined for empty and placeholder values", () => {
    expect(normalizeAssistHardwareValue("")).toBeUndefined();
    expect(normalizeAssistHardwareValue("   ")).toBeUndefined();
    expect(normalizeAssistHardwareValue("N/A")).toBeUndefined();
    expect(normalizeAssistHardwareValue("unknown")).toBeUndefined();
  });

  it("keeps real manufacturer names", () => {
    expect(normalizeAssistHardwareValue("Posiflex")).toBe("Posiflex");
  });
});

describe("resolveHardwareFieldFromAssistAndTemplate", () => {
  it("uses template when Assist reports N/A", () => {
    expect(
      resolveHardwareFieldFromAssistAndTemplate("N/A", "Posiflex")
    ).toBe("Posiflex");
  });

  it("prefers Assist when it has a real value", () => {
    expect(
      resolveHardwareFieldFromAssistAndTemplate("Dell", "Posiflex")
    ).toBe("Dell");
  });

  it("uses template when Assist omits the field", () => {
    expect(
      resolveHardwareFieldFromAssistAndTemplate(null, "Posiflex")
    ).toBe("Posiflex");
  });
});
