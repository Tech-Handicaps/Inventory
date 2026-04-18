/**
 * Heuristic procurement / fleet narratives from aggregated register data.
 * Registration year uses dateAdded; purchase year uses purchaseDate when captured.
 */

export type ManufacturerSlice = {
  name: string;
  count: number;
  percent: number;
};

export type ModelSlice = {
  label: string;
  count: number;
  percent: number;
  manufacturer: string | null;
};

export type YearSlice = { year: number; count: number; percent: number };

export type FleetProcurementMetrics = {
  totalOperational: number;
  totalWrittenOff: number;
  totalRegistered: number;
  distinctManufacturers: number;
  distinctModels: number;
  topManufacturerShare: number;
  topThreeModelsShare: number;
  herfindahlManufacturers: number;
  /** Share of operational fleet registered in system in last 24 months (by dateAdded) */
  registeredLast24MonthsPct: number;
  byManufacturer: ManufacturerSlice[];
  byModel: ModelSlice[];
  byRegistrationYear: YearSlice[];
  /** Units with purchaseDate set */
  withPurchaseDate: number;
  /** Units with warrantyEndDate set */
  withWarrantyEnd: number;
  purchaseDateCoveragePct: number;
  warrantyEndCoveragePct: number;
  /** Mean age in years where purchaseDate known */
  averageFleetAgeYears: number | null;
  warrantyExpiring90Days: number;
  warrantyExpired: number;
  /** Known warranty end ≥ today */
  warrantyActiveKnown: number;
  byPurchaseYear: YearSlice[];
  /** True when ≥25% of operational units have purchaseDate — purchase-year charts are meaningful */
  usePurchaseYearForAge: boolean;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function generateProcurementInsightBullets(
  input: FleetProcurementMetrics
): string[] {
  const lines: string[] = [];
  const t = input.totalOperational;
  if (t === 0) {
    lines.push(
      "No operational units to analyse (all assets may be written off, or the register is empty)."
    );
    return lines;
  }

  const topMfg = input.byManufacturer[0];
  if (topMfg) {
    lines.push(
      `Largest OEM share: ${topMfg.name} at ${round1(topMfg.percent)}% of the operational fleet (${topMfg.count} units).`
    );
    if (input.topManufacturerShare >= 50) {
      lines.push(
        "High single-vendor concentration — negotiate volume pricing, but plan dual-sourcing or a second qualified OEM to reduce supply and security risk."
      );
    } else if (input.topManufacturerShare >= 35) {
      lines.push(
        "Moderate OEM concentration — acceptable if support contracts align; track failure/write-off rates by manufacturer outside this dashboard."
      );
    }
  }

  if (input.topThreeModelsShare >= 70) {
    lines.push(
      `The top three SKUs represent ${round1(input.topThreeModelsShare)}% of units — strong standardisation (easier imaging/spares) but a spike in defects or EOS on those SKUs hits a large share of the estate.`
    );
  } else if (input.topThreeModelsShare <= 35 && input.distinctModels >= 8) {
    lines.push(
      `Fleet is spread across many SKUs (top three only ${round1(input.topThreeModelsShare)}%) — consider consolidating on fewer templates for procurement and support efficiency.`
    );
  }

  if (input.herfindahlManufacturers > 0.25 && input.distinctManufacturers >= 4) {
    lines.push(
      "Manufacturer mix is relatively fragmented — spare parts and engineer training may cost more than a more uniform OEM strategy."
    );
  }

  if (input.registeredLast24MonthsPct >= 45) {
    lines.push(
      `${round1(input.registeredLast24MonthsPct)}% of operational rows were added to this register in the last 24 months — a recent intake wave; align warranty, rollout, and training with that cohort.`
    );
  } else if (input.registeredLast24MonthsPct <= 15 && t >= 20) {
    lines.push(
      "Few recent registrations vs fleet size — refresh planning should lean on purchase dates and warranty ends where captured, not only register dates."
    );
  }

  if (input.purchaseDateCoveragePct < 40 && t >= 15) {
    lines.push(
      `Purchase dates are on ${round1(input.purchaseDateCoveragePct)}% of operational assets — capturing invoice/PO dates improves depreciation, refresh timing, and TCO versus competitors.`
    );
  }

  if (input.warrantyEndCoveragePct < 35 && t >= 15) {
    lines.push(
      `Warranty end dates are on ${round1(input.warrantyEndCoveragePct)}% of units — recording them unlocks renewal planning and avoids surprise post-warranty support spend.`
    );
  }

  if (
    input.averageFleetAgeYears != null &&
    input.withPurchaseDate >= 5 &&
    input.averageFleetAgeYears >= 4.5
  ) {
    lines.push(
      `Average fleet age (where purchase date is known) is about ${round1(input.averageFleetAgeYears)} years — align security baselines, spare stock, and replacement waves with policy.`
    );
  }

  if (input.warrantyExpiring90Days >= 3) {
    lines.push(
      `${input.warrantyExpiring90Days} unit(s) have warranty expiring within 90 days — confirm renewals or budget for post-warranty support.`
    );
  } else if (input.warrantyExpiring90Days >= 1 && t <= 30) {
    lines.push(
      `${input.warrantyExpiring90Days} unit(s) have warranty expiring within 90 days — review before coverage lapses.`
    );
  }

  if (input.withWarrantyEnd >= 8 && input.warrantyExpired >= 1) {
    const pastPct = (input.warrantyExpired / input.withWarrantyEnd) * 100;
    if (pastPct >= 35) {
      lines.push(
        `Among assets with a warranty end on file, ${round1(pastPct)}% are already past that date — use repair/write-off history to steer the next manufacturer shortlist.`
      );
    }
  }

  const woRate =
    input.totalRegistered > 0
      ? (input.totalWrittenOff / input.totalRegistered) * 100
      : 0;
  if (input.totalWrittenOff > 0 && woRate >= 12) {
    lines.push(
      `Written-off units are ${round1(woRate)}% of all registered assets — review whether failure modes cluster on specific models or manufacturers before the next tender.`
    );
  }

  lines.push(
    input.usePurchaseYearForAge
      ? "Purchase-year and warranty metrics are populated enough to support buying discussions; keep dates updated as you receive hardware."
      : "Keep adding purchase and warranty dates on register or edit — the dashboard prioritises acquisition signals as coverage grows."
  );

  return lines;
}

export function computeHerfindahl(sharesPercent: number[]): number {
  const frac = sharesPercent.map((p) => p / 100);
  return frac.reduce((s, x) => s + x * x, 0);
}
