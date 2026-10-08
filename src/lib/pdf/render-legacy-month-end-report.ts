import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { reportAssetTypeLabel } from "@/lib/reports/asset-types";
import type { ReportAssetTypeId } from "@/lib/reports/asset-types";
import {
  composeLegacyColumns,
  compositionHeadline,
  legacyLineUnits,
  monthKeyLabel,
  summarizeLegacyLines,
  type LegacyColumnComposition,
  type LegacyMonthEndDraft,
  type LegacyMonthEndLine,
} from "@/lib/reports/legacy-month-end";

export type LegacyMonthEndPdfInput = {
  draft: LegacyMonthEndDraft;
  generatedAt: string;
  logoSource: Buffer | string | null;
};

function cell(value: number): string {
  return `<td class="num">${escHtml(String(value))}</td>`;
}

function isFinanceType(value: string): value is ReportAssetTypeId {
  return value === "hardware" || value === "usb_hid_msr" || value === "other";
}

function financeLabel(financeType: string): string {
  if (isFinanceType(financeType) && financeType !== "other") {
    return reportAssetTypeLabel(financeType);
  }
  return "Other (modems, routers, accessories)";
}

export async function renderLegacyMonthEndPdf(
  input: LegacyMonthEndPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);
  const { draft } = input;
  const label = monthKeyLabel(draft.monthKey);
  const totals = summarizeLegacyLines(draft.lines);

  const financeOrder = ["hardware", "usb_hid_msr", "other"] as const;
  const financeRows = financeOrder
    .map((typeId) => {
      const slice = summarizeLegacyLines(
        draft.lines.filter((line) => line.financeType === typeId)
      );
      return `<tr>
        <td>${escHtml(financeLabel(typeId))}</td>
        ${cell(slice.newStock)}
        ${cell(slice.repairedUsed)}
        ${cell(slice.usable)}
        ${cell(slice.toAssess)}
        ${cell(slice.toDispose)}
        ${cell(slice.warrantyRepair)}
        ${cell(slice.units)}
      </tr>`;
    })
    .join("");

  const itemRows: string[] = [];
  let lastGroup = "";
  for (const line of draft.lines) {
    if (line.groupLabel !== lastGroup) {
      lastGroup = line.groupLabel;
      const group = summarizeLegacyLines(
        draft.lines.filter((row) => row.groupLabel === line.groupLabel)
      );
      itemRows.push(`<tr class="group">
        <td colspan="2">${escHtml(line.groupLabel)}</td>
        ${cell(group.newStock)}
        ${cell(group.repairedUsed)}
        ${cell(group.usable)}
        ${cell(group.toAssess)}
        ${cell(group.toDispose)}
        ${cell(group.warrantyRepair)}
        <td></td>
      </tr>`);
    }
    itemRows.push(lineRow(line));
  }

  const sourceLine =
    draft.sourceKind === "source_file"
      ? `Source file: ${draft.sourceFileName ?? "prior-company workbook"}`
      : `Carried forward from ${monthKeyLabel(draft.carriedForwardFromMonthKey ?? "")} — no separate workbook was supplied`;

  const bodyHtml = `
    <h1>Prior company month-end stock</h1>
    <p class="ref">For month ending ${escHtml(label)}</p>
    <p class="subtitle">Quantity stock take for accounts and audit. Generated ${escHtml(input.generatedAt)}</p>
    <p class="note">${escHtml(sourceLine)}</p>
    <p class="note">${escHtml(draft.notes)}</p>
    <p class="note">Column mapping: New stock stays New stock. Repaired/Used maps to Refurbished. To be assessed/repaired maps to Assessment. To dispose is the written-off quantity on the form (no write-off certificate was issued). Warranty repair is kept on its own and is not folded into In Repairs. Usable = New + Repaired/Used.</p>

    <h2>By finance asset type</h2>
    <table class="list legacy">
      <thead>
        <tr>
          <th>Asset type</th>
          <th class="num">New</th>
          <th class="num">Repaired/Used</th>
          <th class="num">Usable</th>
          <th class="num">To assess</th>
          <th class="num">To dispose</th>
          <th class="num">Warranty</th>
          <th class="num">Units</th>
        </tr>
      </thead>
      <tbody>
        ${financeRows}
        <tr class="total">
          <td><strong>Total</strong></td>
          ${cell(totals.newStock)}
          ${cell(totals.repairedUsed)}
          ${cell(totals.usable)}
          ${cell(totals.toAssess)}
          ${cell(totals.toDispose)}
          ${cell(totals.warrantyRepair)}
          ${cell(totals.units)}
        </tr>
      </tbody>
    </table>

    <h2>What the totals are made of</h2>
    <p class="note">Only lines with a quantity in that column. They add up to the total. Zero lines stay on the itemised form below and are not repeated here.</p>
    ${legacyCompositionHtml(composeLegacyColumns(draft.lines))}

    <h2>Itemised — same lines as the stock-take form</h2>
    <table class="list legacy">
      <thead>
        <tr>
          <th>Make / model</th>
          <th>Type</th>
          <th class="num">New</th>
          <th class="num">Repaired/Used</th>
          <th class="num">Usable</th>
          <th class="num">To assess</th>
          <th class="num">To dispose</th>
          <th class="num">Warranty</th>
          <th>Form note</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows.join("")}
      </tbody>
    </table>
    <p class="footer">Handicaps Network Africa Inventory · Prior company month-end stock · ${escHtml(label)}</p>
    <style>
      .legacy th.num, .legacy td.num { text-align: right; white-space: nowrap; }
      .legacy tr.total, .legacy tr.group { background: #f0faf4; font-weight: bold; }
      .legacy tr.group td { padding-top: 8px; }
      .note { font-size: 9px; color: #333; margin: 0 0 8px 0; }
      .legacy tr.quiet td { color: #888; font-weight: normal; }
      h1 { font-size: 16px; }
    </style>
  `;

  return htmlToPdfBuffer(
    pdfDocumentChrome({
      title: `Prior company month-end stock — ${label}`,
      bodyHtml,
      logoDataUrl,
      landscape: true,
    }),
    { landscape: true }
  );
}

export function legacyCompositionHtml(columns: LegacyColumnComposition[]): string {
  return columns
    .map((column) => {
      const rows = column.lines
        .map((line) => {
          const name = [line.manufacturer, line.model].filter(Boolean).join(" ");
          return `<tr>
            <td>${escHtml(line.groupLabel)}</td>
            <td>${escHtml(name)}</td>
            <td>${escHtml(line.category)}</td>
            ${cell(line.quantity)}
          </tr>`;
        })
        .join("");
      const groups = column.groupTotals
        .map((group) => `${group.groupLabel} ${group.quantity}`)
        .join(", ");
      return `<h3>${escHtml(column.label)} — ${escHtml(String(column.total))}</h3>
        <p class="note">${escHtml(compositionHeadline(column))} By section: ${escHtml(groups)}.</p>
        <table class="list legacy">
          <thead>
            <tr>
              <th>Section</th>
              <th>Make / model</th>
              <th>Type</th>
              <th class="num">Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total">
              <td colspan="3"><strong>Total ${escHtml(column.label.toLowerCase())}</strong></td>
              ${cell(column.total)}
            </tr>
          </tbody>
        </table>`;
    })
    .join("");
}

function lineRow(line: LegacyMonthEndLine): string {
  const name = [line.manufacturer, line.model].filter(Boolean).join(" ");
  const usable = line.newStock + line.repairedUsed;
  const quiet = legacyLineUnits(line) === 0 ? " quiet" : "";
  return `<tr class="${quiet.trim()}">
    <td>${escHtml(name)}</td>
    <td>${escHtml(line.category)}</td>
    ${cell(line.newStock)}
    ${cell(line.repairedUsed)}
    ${cell(usable)}
    ${cell(line.toAssess)}
    ${cell(line.toDispose)}
    ${cell(line.warrantyRepair)}
    <td>${escHtml(line.lineNotes ?? "")}</td>
  </tr>`;
}
