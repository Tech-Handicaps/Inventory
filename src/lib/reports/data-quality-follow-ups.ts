/** Known register records waiting on a decision; each is listed while an asset with that name exists. */
export const DATA_QUALITY_FOLLOW_UPS: { assetName: string; note: string }[] = [
  {
    assetName: "HNA-TEST-01",
    note: "HP Elite 8300 AIO, SN CZC3413ZVB: a real machine re-issued to a club, still under its test name. Mogamat will correct it; leave the record and its repairs as they are until then.",
  },
];

export type DataQualityFollowUp = { assetName: string; note: string };
