import { describe, expect, it } from "vitest";
import { normaliseSerial, parseScanCode } from "./scan-code";

describe("parseScanCode", () => {
  it("returns null for blank input", () => {
    expect(parseScanCode("   ")).toBeNull();
  });

  it("strips serial label prefixes and spaces", () => {
    expect(parseScanCode("S/N: ABC 123")).toEqual({ kind: "serial", serial: "ABC123", raw: "S/N: ABC 123" });
    expect(normaliseSerial("Serial Number: 5CD1234XYZ")).toBe("5CD1234XYZ");
    expect(normaliseSerial("SN#PF3K9")).toBe("PF3K9");
    expect(normaliseSerial("Service Tag: 7HX2LM3")).toBe("7HX2LM3");
  });

  it("keeps plain serials untouched", () => {
    expect(parseScanCode("7HX2LM3")).toMatchObject({ kind: "serial", serial: "7HX2LM3" });
  });

  it("reads this app's asset links", () => {
    expect(parseScanCode("https://inventory-omega-steel.vercel.app/assets?asset=cmabc123")).toMatchObject({
      kind: "asset_id",
      assetId: "cmabc123",
    });
  });

  it("takes the service tag from vendor QR links", () => {
    expect(parseScanCode("https://qrl.dell.com/7HX2LM3")).toMatchObject({ kind: "serial", serial: "7HX2LM3" });
  });

  it("drops control characters from scanner input", () => {
    expect(parseScanCode("ABC123\r\n")).toMatchObject({ serial: "ABC123" });
  });
});
