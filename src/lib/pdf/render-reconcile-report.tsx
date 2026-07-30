import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import type { StockReconcileReport } from "@/lib/reports/stock-reconcile";

export type ReconcileReportPdfInput = {
  title: string;
  subtitle: string;
  generatedAt: string;
  logoSource: Buffer | string | null;
  report: StockReconcileReport;
};

function cell(value: number): string {
  return `<td class="num">${escHtml(String(value))}</td>`;
}

export async function renderReconcileReportPdf(
  input: ReconcileReportPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);

  const stockRows = input.report.stockRows
    .map(
      (r) => `<tr>
        <td>${escHtml(r.assetTypeLabel)}</td>
        ${cell(r.newStock)}
        ${cell(r.refurbished)}
        ${cell(r.totalStock)}
      </tr>`
    )
    .join("");

  const stockGrand = input.report.stockGrandTotal;

  const fullRows = input.report.fullStatusRows
    .map(
      (r) => `<tr>
        <td>${escHtml(r.assetTypeLabel)}</td>
        ${cell(r.newStock)}
        ${cell(r.refurbished)}
        ${cell(r.totalStock)}
        ${cell(r.deployed)}
        ${cell(r.assessment)}
        ${cell(r.repair)}
        ${cell(r.writtenOff)}
        ${cell(r.grandTotal)}
      </tr>`
    )
    .join("");

  const fullGrand = input.report.fullStatusGrandTotal;

  const uncategorizedNote =
    input.report.uncategorizedCount > 0
      ? `<p class="note warn">${escHtml(
          `${input.report.uncategorizedCount} asset(s) use a category that is not mapped to Hardware or USB HID Magnetic Stripe Readers. Review categories in Settings or update asset rows so finance totals are complete.`
        )}</p>`
      : "";

  const bodyHtml = `
    <h1>${escHtml(input.title)}</h1>
    <p class="subtitle">${escHtml(input.subtitle)}</p>
    <p class="subtitle">Generated ${escHtml(input.generatedAt)}</p>
    <p class="note">${escHtml(input.report.generatedNote)}</p>

    <h2>Stock on hand — by asset type</h2>
    <p class="note">For monthly finance reconciliation. Total stock = New stock + Refurbished only.</p>
    <table class="list reconcile">
      <thead>
        <tr>
          <th>Asset type</th>
          <th class="num">New stock</th>
          <th class="num">Refurbished</th>
          <th class="num">Total stock</th>
        </tr>
      </thead>
      <tbody>
        ${stockRows}
        <tr class="total">
          <td><strong>Grand total</strong></td>
          ${cell(stockGrand.newStock)}
          ${cell(stockGrand.refurbished)}
          ${cell(stockGrand.totalStock)}
        </tr>
      </tbody>
    </table>

    <h2>Full register — by asset type and lifecycle</h2>
    <p class="note">All units in the system, split by type. Use with the stock table above for audit.</p>
    <table class="list reconcile wide">
      <thead>
        <tr>
          <th>Asset type</th>
          <th class="num">New</th>
          <th class="num">Refurb</th>
          <th class="num">Stock</th>
          <th class="num">Deployed</th>
          <th class="num">Assessment</th>
          <th class="num">Repair</th>
          <th class="num">Written off</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${fullRows}
        <tr class="total">
          <td><strong>Grand total</strong></td>
          ${cell(fullGrand.newStock)}
          ${cell(fullGrand.refurbished)}
          ${cell(fullGrand.totalStock)}
          ${cell(fullGrand.deployed)}
          ${cell(fullGrand.assessment)}
          ${cell(fullGrand.repair)}
          ${cell(fullGrand.writtenOff)}
          ${cell(fullGrand.grandTotal)}
        </tr>
      </tbody>
    </table>
    ${uncategorizedNote}
    <p class="footer">Handicaps Network Africa Inventory · ${escHtml(input.title)}</p>
    <style>
      .reconcile th.num, .reconcile td.num { text-align: right; }
      .reconcile tr.total { background: #f0faf4; font-weight: bold; }
      .note { font-size: 9pt; color: #555; margin: 8px 0; }
      .note.warn { color: #92400e; background: #fffbeb; padding: 8px; border-radius: 4px; }
      table.wide { font-size: 8pt; }
    </style>
  `;

  return htmlToPdfBuffer(
    pdfDocumentChrome({
      title: input.title,
      bodyHtml,
      logoDataUrl,
    })
  );
}
