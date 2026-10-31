/** Allowed status moves from the hardware board (server also enforces). Client-safe — no Prisma. */
export const HARDWARE_BOARD_STATUS_MOVES: Record<string, readonly string[]> = {
  deployed: ["assessment"],
  assessment: ["deployed", "refurbished"],
  repair: ["deployed", "refurbished"],
  refurbished: ["deployed", "new_stock"],
  new_stock: ["deployed", "repair", "refurbished"],
};

export function isAllowedHardwareBoardMove(
  fromStatusCode: string,
  toStatusCode: string
): boolean {
  if (fromStatusCode === toStatusCode) return true;
  const allowed = HARDWARE_BOARD_STATUS_MOVES[fromStatusCode];
  if (!allowed) return true;
  return allowed.includes(toStatusCode);
}

/**
 * What dropping (or "Move to…") a card onto a stage does:
 * - "confirm": plain status change after a confirmation dialog
 * - "assessment" / "repair" / "writeoff": opens that workflow's own dialog, which creates its record
 * - null: not allowed from the card's current stage
 */
export type BoardDropAction = "confirm" | "assessment" | "repair" | "writeoff";

export function boardDropAction(
  fromStatusCode: string,
  toStatusCode: string
): BoardDropAction | null {
  if (fromStatusCode === toStatusCode) return null;
  if (toStatusCode === "written_off") {
    if (fromStatusCode === "assessment" || fromStatusCode === "repair") return "writeoff";
    return isAllowedHardwareBoardMove(fromStatusCode, toStatusCode) ? "confirm" : null;
  }
  if (toStatusCode === "assessment" && fromStatusCode === "deployed") return "assessment";
  if (toStatusCode === "repair") {
    if (fromStatusCode === "deployed") return null;
    if (fromStatusCode === "written_off") return "confirm";
    return "repair";
  }
  return isAllowedHardwareBoardMove(fromStatusCode, toStatusCode) ? "confirm" : null;
}

/** Side effects worth telling the user about before a plain status change. */
export function boardMoveConsequences(
  fromStatusCode: string,
  toStatusCode: string
): string[] {
  const notes: string[] = [];
  if (
    toStatusCode === "deployed" &&
    (fromStatusCode === "assessment" || fromStatusCode === "repair")
  ) {
    notes.push("A dispatch voucher is issued for this unit.");
  }
  if (
    fromStatusCode === "assessment" &&
    (toStatusCode === "deployed" || toStatusCode === "refurbished")
  ) {
    notes.push("The open Assessment/Maintenance intake is marked completed.");
  }
  return notes;
}

export function hardwareBoardMoveError(
  fromStatusCode: string,
  toStatusCode: string
): string | null {
  if (isAllowedHardwareBoardMove(fromStatusCode, toStatusCode)) return null;
  if (fromStatusCode === "deployed" && toStatusCode === "refurbished") {
    return "Send hardware to Assessment/Maintenance first, then move to Refurbished after triage.";
  }
  if (fromStatusCode === "deployed" && toStatusCode === "written_off") {
    return "Send hardware to Assessment/Maintenance first, then write off from that stage if needed.";
  }
  if (fromStatusCode === "deployed" && toStatusCode === "repair") {
    return "Move Deployed hardware to Assessment/Maintenance first (then Log repair only if a formal repair is required).";
  }
  return `Cannot move directly from ${fromStatusCode} to ${toStatusCode}. Use the workflow actions on the card.`;
}
