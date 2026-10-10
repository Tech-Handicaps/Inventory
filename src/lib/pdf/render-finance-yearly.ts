import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { formatFinanceChange } from "@/lib/reports/finance-month-on-month";
import type { FinanceTypeTotals } from "@/lib/reports/finance-month-on-month";
import type { WorkbookGroupRow } from "@/lib/reports/legacy-month-end";
import {
  FINANCE_YEAR_TYPE_NOTE,
  WORKBOOK_GROUP_NOTE,
  type FinanceYearBlock,
  type FinanceYearlyReport,
  type WorkbookYearBlock,
} from "@/lib/reports/finance-yearly";

export type FinanceYearlyPdfInput = {
  report: FinanceYearlyReport;
  generatedAt: string;
  logoSource: Buffer | string | null;
};

function num(value: number): string {
  return `<td class="num">${escHtml(String(value))}</td>`;
}

function signed(value: number | null): string {
  if (value === null) return `<td class="num">—</td>`;
  const cls = value > 0 ? "up" : value < 0 ? "down" : "";
  return `<td class="num ${cls}">${escHtml(formatFinanceChange(value))}</td>`;
}

function quantityCells(row: {
  newStock: number;
  repairedUsed: number;
  usable: number;
  toAssess: number;
  toDispose: number;
  warrantyRepair: number;
  units: number;
}): string {
  return `${num(row.newStock)}
          ${num(row.repairedUsed)}
          ${num(row.usable)}
          ${num(row.toAssess)}
          ${num(row.toDispose)}
          ${num(row.warrantyRepair)}
          ${num(row.units)}`;
}

function workbookHead(): string {
  return `<tr>
          <th>Section</th>
          <th class="num">New</th>
          <th class="num">Repaired/Used</th>
          <th class="num">Usable</th>
          <th class="num">To assess</th>
          <th class="num">To dispose</th>
          <th class="num">Warranty</th>
          <th class="num">Units</th>
        </tr>`;
}

function sumGroups(groups: WorkbookGroupRow[]): WorkbookGroupRow {
  return groups.reduce(
    (acc, row) => ({
      groupLabel: "Total",
      newStock: acc.newStock + row.newStock,
      repairedUsed: acc.repairedUsed + row.repairedUsed,
      usable: acc.usable + row.usable,
      toAssess: acc.toAssess + row.toAssess,
      toDispose: acc.toDispose + row.toDispose,
      warrantyRepair: acc.warrantyRepair + row.warrantyRepair,
      units: acc.units + row.units,
    }),
    {
      groupLabel: "Total",
      newStock: 0,
      repairedUsed: 0,
      usable: 0,
      toAssess: 0,
      toDispose: 0,
      warrantyRepair: 0,
      units: 0,
    }
  );
}

function groupTable(groups: WorkbookGroupRow[]): string {
  const total = sumGroups(groups);
  return `<h3>What the 2025 totals are made of</h3>
    <p class="note">${escHtml(WORKBOOK_GROUP_NOTE)}</p>
    <table class="list audit">
      <thead>${workbookHead()}</thead>
      <tbody>
        ${groups
          .map(
            (row) => `<tr>
          <td>${escHtml(row.groupLabel)}</td>
          ${quantityCells(row)}
        </tr>`
          )
          .join("")}
        <tr>
          <td><strong>${escHtml(total.groupLabel)}</strong></td>
          ${quantityCells(total)}
        </tr>
      </tbody>
    </table>`;
}

function workbookBlock(block: WorkbookYearBlock | null): string {
  if (!block) {
    return `<h2>2025</h2><p class="note">The December 2025 workbook is not on file.</p>`;
  }
  return `<h2>2025 — December workbook</h2>
    <p class="note">${escHtml(block.basis)}</p>
    <p class="note">Source: ${escHtml(block.sourceLabel)}. ${escHtml(block.monthEndingLabel)}.</p>
    <table class="list audit">
      <thead>
        <tr>
          <th>Year</th>
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
        <tr>
          <td>2025</td>
          ${quantityCells(block)}
        </tr>
      </tbody>
    </table>
    ${groupTable(block.groups)}`;
}

function registerCells(row: {
  newStock: number;
  refurbished: number;
  usable: number;
  deployed: number;
  assessment: number;
  inRepair: number;
  writtenOff: number;
  register: number;
}): string {
  return `${num(row.newStock)}
          ${num(row.refurbished)}
          ${num(row.usable)}
          ${num(row.deployed)}
          ${num(row.assessment)}
          ${num(row.inRepair)}
          ${num(row.writtenOff)}
          ${num(row.register)}`;
}

function typeClosingTable(types: FinanceTypeTotals[]): string {
  if (types.length === 0) {
    return `<p class="note">Asset-type totals were not stored with this pack.</p>`;
  }
  return `<h3>What the 2026 closing row is made of</h3>
    <p class="note">${escHtml(FINANCE_YEAR_TYPE_NOTE)}</p>
    <table class="list audit">
      <thead>
        <tr>
          <th>Heading</th>
          <th class="num">New stock</th>
          <th class="num">Refurbished</th>
          <th class="num">Usable</th>
          <th class="num">Deployed</th>
          <th class="num">Assessment</th>
          <th class="num">In repairs</th>
          <th class="num">Written off</th>
          <th class="num">Register</th>
        </tr>
      </thead>
      <tbody>
        ${types
          .map(
            (row) => `<tr>
          <td>${escHtml(row.label)}</td>
          ${registerCells(row)}
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function financeBlock(block: FinanceYearBlock): string {
  const closing = block.closing;
  const position = closing
    ? `<table class="list audit">
      <thead>
        <tr>
          <th>Closing month</th>
          <th class="num">New stock</th>
          <th class="num">Refurbished</th>
          <th class="num">Usable</th>
          <th class="num">Deployed</th>
          <th class="num">Assessment</th>
          <th class="num">In repairs</th>
          <th class="num">Written off</th>
          <th class="num">Register</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escHtml(closing.monthEndingLabel)}</td>
          ${registerCells(closing)}
        </tr>
      </tbody>
    </table>
    ${typeClosingTable(closing.types)}`
    : "";
  const months =
    block.months.length === 0
      ? ""
      : `<h3>Months inside 2026</h3>
    <p class="note">Each row is a stored finance pack. Change is against the previous stored month of this year.</p>
    <table class="list audit">
      <thead>
        <tr>
          <th>Month ending</th>
          <th class="num">New stock</th>
          <th class="num">Refurbished</th>
          <th class="num">Usable</th>
          <th class="num">Deployed</th>
          <th class="num">Assessment</th>
          <th class="num">In repairs</th>
          <th class="num">Written off</th>
          <th class="num">Register</th>
          <th class="num">Usable vs previous stored</th>
          <th class="num">Register vs previous stored</th>
        </tr>
      </thead>
      <tbody>
        ${block.months
          .map(
            (month) => `<tr>
          <td>${escHtml(month.monthEndingLabel)}</td>
          ${num(month.newStock)}
          ${num(month.refurbished)}
          ${num(month.usable)}
          ${num(month.deployed)}
          ${num(month.assessment)}
          ${num(month.inRepair)}
          ${num(month.writtenOff)}
          ${num(month.register)}
          ${signed(month.usableChange)}
          ${signed(month.registerChange)}
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  const typeMonths =
    block.typeBlocks.length === 0
      ? ""
      : `<h3>2026 headings by stored month</h3>
    <p class="note">${escHtml(block.typeNote)} A change is against the previous stored month of that same heading.</p>
    ${block.typeBlocks
      .map(
        (typeBlock) => `<h3>${escHtml(typeBlock.label)}</h3>
      <table class="list audit">
        <thead>
          <tr>
            <th>Month ending</th>
            <th class="num">New stock</th>
            <th class="num">Refurbished</th>
            <th class="num">Usable</th>
            <th class="num">Deployed</th>
            <th class="num">Assessment</th>
            <th class="num">In repairs</th>
            <th class="num">Written off</th>
            <th class="num">Register</th>
            <th class="num">Usable vs previous stored</th>
            <th class="num">Register vs previous stored</th>
          </tr>
        </thead>
        <tbody>
          ${typeBlock.months
            .map(
              (month) => `<tr>
            <td>${escHtml(month.monthEndingLabel)}</td>
            ${registerCells(month)}
            ${signed(month.usableChange)}
            ${signed(month.registerChange)}
          </tr>`
            )
            .join("")}
        </tbody>
      </table>`
      )
      .join("")}`;
  return `<h2>2026 — ${block.closed ? "closing finance pack" : "open year"}</h2>
    <p class="note">${escHtml(block.basis)}</p>
    ${position}
    ${months}
    ${typeMonths}`;
}

export async function renderFinanceYearlyPdf(
  input: FinanceYearlyPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);
  const introduction = input.report.introduction
    .map((paragraph) => `<p class="note">${escHtml(paragraph)}</p>`)
    .join("");
  const bodyHtml = `
    <h1>Finance yearly</h1>
    <p class="subtitle">One block per year. Generated ${escHtml(input.generatedAt)}</p>
    ${introduction}
    ${workbookBlock(input.report.workbook2025)}
    ${financeBlock(input.report.finance2026)}
    <p class="footer">Handicaps Network Africa Inventory · Finance yearly · blocks are not subtracted</p>
    <style>
      .audit th.num, .audit td.num { text-align: right; white-space: nowrap; }
      .audit td.up { color: #0b6b3a; }
      .audit td.down { color: #9b1c1c; }
      .note { font-size: 9px; color: #333; margin: 0 0 8px 0; line-height: 1.4; }
      h1 { font-size: 16px; }
      h2 { margin-top: 14px; }
    </style>
  `;
  return htmlToPdfBuffer(
    pdfDocumentChrome({
      title: "Finance yearly",
      bodyHtml,
      logoDataUrl,
      landscape: true,
    }),
    { landscape: true }
  );
}
