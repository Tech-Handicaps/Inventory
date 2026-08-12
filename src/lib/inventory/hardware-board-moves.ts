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
