import {
  ALL_REPORT_ASSET_TYPES,
  classifyReportAssetType,
  reportAssetTypeLabel,
  type ReportAssetTypeId,
} from "@/lib/reports/asset-types";
import type {
  AssetForReconcile,
  StockBreakdownReport,
  StockReconcileReport,
} from "@/lib/reports/stock-reconcile";

export const FINANCE_PACK_BUCKET = "finance-packs";

export type FinancePackTotals = {
  newStock: number;
  refurbished: number;
  usable: number;
  deployed: number;
  assessment: number;
  inRepair: number;
  writtenOff: number;
  register: number;
};

export type FinancePackModelCount = {
  statusCode: string;
  makeModel: string;
  count: number;
  sortOrder: number;
};

export type FinancePackTypeTotals = {
  assetType: string;
  label: string;
  sortOrder: number;
  newStock: number;
  refurbished: number;
  usable: number;
  deployed: number;
  assessment: number;
  inRepair: number;
  writtenOff: number;
  register: number;
};

export type FinanceFieldUnit = {
  assetType: ReportAssetTypeId;
  label: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  sortOrder: number;
};

export type FinancePackSnapshot = {
  totals: FinancePackTotals;
  lines: FinancePackModelCount[];
  typeTotals: FinancePackTypeTotals[];
  fieldUnits: FinanceFieldUnit[];
};

export function financePackStoragePath(
  monthKey: string,
  kind: "reconcile" | "breakdown" | "month-on-month" | "yearly" | "field" | "csv"
): string {
  if (kind === "csv") return `${monthKey}/hna-finance-pack.csv`;
  const file =
    kind === "reconcile"
      ? "hna-monthly-stock-reconcile.pdf"
      : kind === "breakdown"
        ? "hna-stock-breakdown.pdf"
        : kind === "month-on-month"
          ? "hna-finance-month-on-month.pdf"
          : kind === "yearly"
            ? "hna-finance-yearly.pdf"
            : "hna-finance-field-listing.pdf";
  return `${monthKey}/${file}`;
}

/**
 * Deployed units at the moment the pack is built. Hardware, USB readers, and
 * other stay in separate groups. Units that are not deployed are left out.
 */
export function financeFieldListing(assets: AssetForReconcile[]): FinanceFieldUnit[] {
  const rank = new Map(ALL_REPORT_ASSET_TYPES.map((type, index) => [type.id, index]));
  const rows = assets
    .filter((asset) => asset.status.code === "deployed")
    .map((asset) => {
      const assetType = classifyReportAssetType(asset.category, asset.tags);
      return {
        assetType,
        label: reportAssetTypeLabel(assetType),
        manufacturer: asset.manufacturer?.trim() || "Unknown",
        model: asset.model?.trim() || "Unknown",
        serialNumber: asset.serialNumber?.trim() || "",
      };
    })
    .sort((a, b) => {
      const byType = (rank.get(a.assetType) ?? 9) - (rank.get(b.assetType) ?? 9);
      if (byType !== 0) return byType;
      const byMake = a.manufacturer.localeCompare(b.manufacturer);
      if (byMake !== 0) return byMake;
      const byModel = a.model.localeCompare(b.model);
      if (byModel !== 0) return byModel;
      return a.serialNumber.localeCompare(b.serialNumber);
    });
  return rows.map((row, sortOrder) => ({ ...row, sortOrder }));
}

/**
 * Keep the pack only after a scheduled send reached at least one recipient,
 * and only when that report month is not already stored.
 */
export function shouldKeepOfficialPack(input: {
  mode: "cron" | "manual_test";
  sent: number;
  alreadyKept: boolean;
}): boolean {
  return input.mode === "cron" && input.sent > 0 && !input.alreadyKept;
}

export function financePackSnapshot(
  reconcile: StockReconcileReport,
  breakdown: StockBreakdownReport,
  assets: AssetForReconcile[] = []
): FinancePackSnapshot {
  const totals = reconcile.fullStatusGrandTotal;
  const lines: FinancePackModelCount[] = [];
  let sortOrder = 0;
  for (const section of breakdown.sections) {
    for (const model of section.models) {
      lines.push({
        statusCode: section.statusCode,
        makeModel: model.makeModel,
        count: model.count,
        sortOrder,
      });
      sortOrder += 1;
    }
  }
  return {
    totals: {
      newStock: totals.newStock,
      refurbished: totals.refurbished,
      usable: totals.totalStock,
      deployed: totals.deployed,
      assessment: totals.assessment,
      inRepair: totals.repair,
      writtenOff: totals.writtenOff,
      register: totals.grandTotal,
    },
    lines,
    typeTotals: reconcile.typeRows.map((row, sortOrder) => ({
      assetType: row.assetTypeId,
      label: row.assetTypeLabel,
      sortOrder,
      newStock: row.newStock,
      refurbished: row.refurbished,
      usable: row.totalStock,
      deployed: row.deployed,
      assessment: row.assessment,
      inRepair: row.repair,
      writtenOff: row.writtenOff,
      register: row.grandTotal,
    })),
    fieldUnits: financeFieldListing(assets),
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One CSV per stored pack: totals by asset type, make/model counts, deployed serials. */
export function financePackCsv(monthEndingLabel: string, snapshot: FinancePackSnapshot): string {
  const rows: (string | number)[][] = [
    ["HNA finance pack", monthEndingLabel],
    [],
    ["Section", "Asset type", "New stock", "Refurbished", "Usable", "Deployed", "Assessment", "In repair", "Written off", "Register"],
    ...snapshot.typeTotals.map((row) => [
      "Totals by asset type",
      row.label,
      row.newStock,
      row.refurbished,
      row.usable,
      row.deployed,
      row.assessment,
      row.inRepair,
      row.writtenOff,
      row.register,
    ]),
    [
      "Totals",
      "All",
      snapshot.totals.newStock,
      snapshot.totals.refurbished,
      snapshot.totals.usable,
      snapshot.totals.deployed,
      snapshot.totals.assessment,
      snapshot.totals.inRepair,
      snapshot.totals.writtenOff,
      snapshot.totals.register,
    ],
    [],
    ["Section", "Status", "Make / model", "Count"],
    ...snapshot.lines.map((line) => ["Make and model", line.statusCode, line.makeModel, line.count]),
    [],
    ["Section", "Asset type", "Make", "Model", "Serial"],
    ...snapshot.fieldUnits.map((unit) => ["Deployed unit", unit.label, unit.manufacturer, unit.model, unit.serialNumber]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
