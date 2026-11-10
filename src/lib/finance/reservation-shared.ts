/** A New Stock / Refurbished unit set aside for a club until it shows up in Zoho Assist. */
export type ReplacementReservation = {
  reservedAt: string;
  clubId: string | null;
  clubName: string | null;
  /** Set when the reservation came from the write-off form. */
  writeOffId: string | null;
  certificateReference: string | null;
  writtenOffAssetName: string | null;
};

/** "Club (HNA-WOF-…)" style text for badges and messages. */
export function reservationLabel(
  r: Pick<ReplacementReservation, "clubName" | "certificateReference">
): string {
  const club = r.clubName ?? "a club";
  return r.certificateReference ? `${club} (${r.certificateReference})` : club;
}
