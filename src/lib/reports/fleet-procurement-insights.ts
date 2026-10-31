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
      `Largest brand: ${topMfg.name} at ${round1(topMfg.percent)}% of units in use (${topMfg.count} units).`
    );
    if (input.topManufacturerShare >= 50) {
      lines.push(
        "One brand makes up most of the fleet — good for volume pricing, but consider a second approved brand to reduce supply risk."
      );
    } else if (input.topManufacturerShare >= 35) {
      lines.push(
        "One brand makes up a large part of the fleet — fine if support contracts cover it; keep an eye on failures and write-offs per brand."
      );
    }
  }

  if (input.topThreeModelsShare >= 70) {
    lines.push(
      `The three most common models make up ${round1(input.topThreeModelsShare)}% of units — easier to image and keep spares for, but a fault or end of support on those models would affect a large share of the fleet.`
    );
  } else if (input.topThreeModelsShare <= 35 && input.distinctModels >= 8) {
    lines.push(
      `The fleet is spread across many models (the top three are only ${round1(input.topThreeModelsShare)}%) — standardising on fewer models would simplify buying and support.`
    );
  }

  if (input.herfindahlManufacturers > 0.25 && input.distinctManufacturers >= 4) {
    lines.push(
      "The fleet is spread across many brands — spare parts and technician training may cost more than with fewer brands."
    );
  }

  if (input.registeredLast24MonthsPct >= 45) {
    lines.push(
      `${round1(input.registeredLast24MonthsPct)}% of in-use units were added to this register in the last 24 months — plan warranty, rollout and training around that recent intake.`
    );
  } else if (input.registeredLast24MonthsPct <= 15 && t >= 20) {
    lines.push(
      "Few units were added recently — base replacement planning on purchase and warranty dates where they are recorded, not on the date added."
    );
  }

  if (input.purchaseDateCoveragePct < 40 && t >= 15) {
    lines.push(
      `Purchase dates are on ${round1(input.purchaseDateCoveragePct)}% of in-use units — recording invoice dates improves depreciation, replacement timing and cost tracking.`
    );
  }

  if (input.warrantyEndCoveragePct < 35 && t >= 15) {
    lines.push(
      `Warranty end dates are on ${round1(input.warrantyEndCoveragePct)}% of units — recording them makes renewal planning possible and avoids surprise repair costs.`
    );
  }

  if (
    input.averageFleetAgeYears != null &&
    input.withPurchaseDate >= 5 &&
    input.averageFleetAgeYears >= 4.5
  ) {
    lines.push(
      `Average fleet age (where purchase date is known) is about ${round1(input.averageFleetAgeYears)} years — plan spares and replacements accordingly.`
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
        `Among assets with a warranty end on file, ${round1(pastPct)}% are already past that date — use repair and write-off history when choosing the next brand.`
      );
    }
  }

  const woRate =
    input.totalRegistered > 0
      ? (input.totalWrittenOff / input.totalRegistered) * 100
      : 0;
  if (input.totalWrittenOff > 0 && woRate >= 12) {
    lines.push(
      `Written-off units are ${round1(woRate)}% of all units — check whether failures cluster on particular models or brands before the next purchase.`
    );
  }

  lines.push(
    input.usePurchaseYearForAge
      ? "Enough purchase and warranty dates are recorded to support buying decisions; keep adding them as hardware arrives."
      : "Keep adding purchase and warranty dates when registering or editing units — age and warranty figures become reliable as more are filled in."
  );

  return lines;
}

export function computeHerfindahl(sharesPercent: number[]): number {
  const frac = sharesPercent.map((p) => p / 100);
  return frac.reduce((s, x) => s + x * x, 0);
}
