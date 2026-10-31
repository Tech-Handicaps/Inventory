import { describe, expect, it } from "vitest";
import { boardDropAction, boardMoveConsequences } from "./hardware-board-moves";

describe("boardDropAction", () => {
  it("ignores drops on the same stage", () => {
    expect(boardDropAction("deployed", "deployed")).toBeNull();
  });

  it("confirms plain allowed moves", () => {
    expect(boardDropAction("new_stock", "deployed")).toBe("confirm");
    expect(boardDropAction("assessment", "refurbished")).toBe("confirm");
  });

  it("blocks moves the server rejects", () => {
    expect(boardDropAction("deployed", "refurbished")).toBeNull();
    expect(boardDropAction("deployed", "repair")).toBeNull();
    expect(boardDropAction("deployed", "written_off")).toBeNull();
    expect(boardDropAction("new_stock", "written_off")).toBeNull();
  });

  it("routes workflow stages to their own dialogs", () => {
    expect(boardDropAction("deployed", "assessment")).toBe("assessment");
    expect(boardDropAction("assessment", "repair")).toBe("repair");
    expect(boardDropAction("new_stock", "repair")).toBe("repair");
    expect(boardDropAction("assessment", "written_off")).toBe("writeoff");
    expect(boardDropAction("repair", "written_off")).toBe("writeoff");
  });

  it("lets written-off hardware be restored with a confirmation", () => {
    expect(boardDropAction("written_off", "new_stock")).toBe("confirm");
    expect(boardDropAction("written_off", "repair")).toBe("confirm");
  });
});

describe("boardMoveConsequences", () => {
  it("warns about the dispatch voucher and intake completion", () => {
    expect(boardMoveConsequences("assessment", "deployed")).toHaveLength(2);
    expect(boardMoveConsequences("repair", "deployed")).toEqual([
      "A dispatch voucher is issued for this unit.",
    ]);
    expect(boardMoveConsequences("new_stock", "deployed")).toEqual([]);
  });
});
