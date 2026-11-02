import { describe, expect, it } from "vitest";
import {
  buildFieldCaptureBreakdown,
  captureArithmetic,
  clubKey,
  modelFamily,
  parseFieldExport,
  registerModelFamily,
  type FieldTerminal,
} from "@/lib/reports/field-export";

const t = (terminalId: string, clubId: string, club: string, type: string, ownership: FieldTerminal["ownership"] = "HNA") => ({
  terminalId,
  clubId,
  club,
  type,
  ownership,
});

describe("modelFamily", () => {
  it("joins export and register spellings of one model", () => {
    expect(modelFamily("POSIFLEX PS-3316E")).toBe("Posiflex PS-3316");
    expect(registerModelFamily("N/A", "PS-3316")).toBe("Posiflex PS-3316");
    expect(modelFamily("DELL 3050")).toBe("Dell OptiPlex 3050");
    expect(registerModelFamily("Dell Inc.", "OptiPlex 3050 AIO")).toBe("Dell OptiPlex 3050");
    expect(modelFamily("Asus Screen & NUC7CJYH")).toBe(modelFamily("Mecer LE22BW Screen & NUC7CJYH"));
    expect(registerModelFamily("Mustek6376 MST6376", "Mecer")).toBe("Mecer X22S");
    expect(registerModelFamily("Mecer", "Mecer", { manufacturer: "Mustek6376 MST6376", model: "Mecer" })).toBe("Mecer X22S");
    expect(modelFamily("HP8300")).toBe("HP Compaq Elite 8300");
    expect(registerModelFamily("MICRO-STAR INTERNATIONAL CO., LTD", "MS-A95311")).toBe("MSI MS-A95311");
    expect(registerModelFamily("empty", "empty")).toBe("Model not recorded");
  });

  it("never merges Lenovo M810z and 10Q0", () => {
    expect(modelFamily("Lenovo M810Z")).toBe("Lenovo M810z");
    expect(registerModelFamily("LENOVO", "10Q0S0CU00")).toBe("Lenovo 10Q0");
  });
});

describe("clubKey", () => {
  it("ignores suffixes, punctuation and known misspellings", () => {
    expect(clubKey("MOUNT EDGECOMBE COUNTRY CLUB")).toBe(clubKey("MOUNT EDGECOMBE CC"));
    expect(clubKey("Fynbos Golf Club (Pty) Ltd")).toBe(clubKey("FYNBOS GOLF CLUB"));
    expect(clubKey("KLEINMOND GOLD CLUB")).toBe(clubKey("KLEINMOND GOLF CLUB"));
    expect(clubKey("WESSELBRON GOLF CLUB")).toBe(clubKey("WESSELSBRON GOLF CLUB"));
  });
});

describe("buildFieldCaptureBreakdown", () => {
  const terminals = [
    t("1", "68", "PRETORIA COUNTRY CLUB", "Dell 3050"),
    t("2", "69", "PRETORIA GOLF CLUB", "Dell 3050"),
    t("3", "70", "KRIEL GOLF CLUB", "POSIFLEX PS-3316E"),
    t("4", "70", "KRIEL GOLF CLUB", "Mecer X22S"),
    t("5", "71", "BOTHAVILLE", "Club Machine", "Club"),
    t("6", "72", "BEAUFORT WEST GOLF CLUB", "MSI AP190", ""),
  ];
  const unit = (club: string | null, manufacturer: string, model: string) => ({
    assetName: `HNA-${club ?? "X"}`,
    serialNumber: null,
    manufacturer,
    model,
    club,
  });

  it("keeps clubs that only share a short name apart and matches by club then model", () => {
    const b = buildFieldCaptureBreakdown(terminals, [
      unit("PRETORIA GOLF CLUB", "Dell Inc.", "OptiPlex 3050 AIO"),
      unit("KRIEL GOLF CLUB", "PosiFlex", "PS-3316"),
      unit("UMTATA COUNTRY CLUB", "LENOVO", "10Q0S0CU00"),
    ]);
    expect(b.notCaptured.map((r) => r.terminalId)).toEqual(["4", "1"]);
    expect(b.outsideExport.map((u) => u.club)).toEqual(["UMTATA COUNTRY CLUB"]);
    expect(b.matched).toBe(2);
    expect(b.byClub.find((c) => c.clubId === "69")).toMatchObject({ inExport: 1, captured: 1, notYetCaptured: 0 });
    expect(b.byModel.find((m) => m.model === "Lenovo 10Q0")).toBeUndefined();
    expect(b.byModel.find((m) => m.model === "Mecer X22S")).toMatchObject({ inExport: 1, captured: 0, notYetCaptured: 1 });
    expect(b.byModel.reduce((s, m) => s + m.captured, 0)).toBe(b.matched);
    expect(b.byModel.reduce((s, m) => s + m.notYetCaptured, 0)).toBe(b.notCaptured.length);
    expect(b.byClub.reduce((s, c) => s + c.captured, 0)).toBe(b.matched);
    expect(b.clubOwnedByModel).toEqual([{ model: "Club machine", count: 1 }]);
    expect(b.blankOwnership).toHaveLength(1);
  });

  it("explains every Deployed unit that matches no HNA-owned row, so the totals add up", () => {
    const deployed = [
      unit("KRIEL GOLF CLUB", "PosiFlex", "PS-3316"),
      unit("KRIEL GOLF CLUB", "MECER", "X22S-T"),
      unit("KRIEL GOLF CLUB", "Dell Inc.", "OptiPlex 3050 AIO"),
      unit("BOTHAVILLE", "Dell Inc.", "OptiPlex 3050 AIO"),
      unit("UMTATA COUNTRY CLUB", "LENOVO", "10Q0S0CU00"),
    ];
    const b = buildFieldCaptureBreakdown(terminals, deployed);
    expect(b.unmatchedAtClubs.map((u) => [u.club, u.reason])).toEqual([
      ["BOTHAVILLE", "no_hna_rows"],
      ["KRIEL GOLF CLUB", "beyond_export_count"],
    ]);
    const a = captureArithmetic(deployed.length, 4, b);
    expect(a).toMatchObject({ matched: 2, notCaptured: 2, outsideExport: 1, noHnaRows: 1, beyondExportCount: 1, notMatched: 3 });
    expect(a.matched + a.notCaptured).toBe(a.hnaOwned);
    expect(a.matched + a.outsideExport + a.noHnaRows + a.beyondExportCount).toBe(a.deployed);
    expect(a.deployed + a.notCaptured).toBe(a.hnaOwned + a.notMatched);
  });

  it("counts a different model at the right club as captured there", () => {
    const b = buildFieldCaptureBreakdown(terminals, [unit("KRIEL GOLF CLUB", "LENOVO", "10Q0S0CU00")]);
    expect(b.byClub.find((c) => c.clubId === "70")).toMatchObject({ captured: 1, notYetCaptured: 1 });
    expect(b.crossModel).toEqual([{ exportModel: "Posiflex PS-3316", registerModel: "Lenovo 10Q0", count: 1 }]);
    expect(b.byModel.find((m) => m.model === "Posiflex PS-3316")).toMatchObject({ sameModel: 0, otherModel: 1 });
  });
});

describe("parseFieldExport", () => {
  it("finds the terminal sheet by its headers and reads the date from the sheet name", () => {
    const parsed = parseFieldExport([
      { name: "Sheet1", rows: [["Terminal Type", "Count"], ["Dell 3050", "44"]] },
      {
        name: "14102025_154130_terminal_report",
        rows: [
          ["Club ID", "Club", "Terminal ID", "x", "Terminal Type", "Ownership Type"],
          ["68", "PRETORIA COUNTRY CLUB", "5300000001", "", "Dell 3050", "HNA"],
          ["71", "BOTHAVILLE", "5300000002", "", "Club Machine", "Club"],
          ["", "", "", "", "", ""],
        ],
      },
    ]);
    expect(parsed.exportDate).toBe("2025-10-14");
    expect(parsed.terminals).toEqual([
      t("5300000001", "68", "PRETORIA COUNTRY CLUB", "Dell 3050"),
      t("5300000002", "71", "BOTHAVILLE", "Club Machine", "Club"),
    ]);
  });
});
