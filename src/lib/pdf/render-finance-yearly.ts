import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { formatFinanceChange } from "@/lib/reports/finance-month-on-month";
import type {
  FinanceYearBlock,
  FinanceYearlyReport,
  WorkbookYearBlock,
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
          ${num(block.newStock)}
          ${num(block.repairedUsed)}
          ${num(block.usable)}
          ${num(block.toAssess)}
          ${num(block.toDispose)}
          ${num(block.warrantyRepair)}
          ${num(block.units)}
        </tr>
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
          ${num(closing.newStock)}
          ${num(closing.refurbished)}
          ${num(closing.usable)}
          ${num(closing.deployed)}
          ${num(closing.assessment)}
          ${num(closing.inRepair)}
          ${num(closing.writtenOff)}
          ${num(closing.register)}
        </tr>
      </tbody>
    </table>`
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
  return `<h2>2026 — ${block.closed ? "closing finance pack" : "open year"}</h2>
    <p class="note">${escHtml(block.basis)}</p>
    ${position}
    ${months}`;
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
