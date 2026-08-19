import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import type { StockBreakdownReport } from "@/lib/reports/stock-reconcile";

export type StockBreakdownPdfInput = {
  title: string;
  subtitle: string;
  generatedAt: string;
  logoSource: Buffer | string | null;
  report: StockBreakdownReport;
};

export async function renderStockBreakdownPdf(
  input: StockBreakdownPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);

  const sectionHtml = input.report.sections
    .map((section) => {
      if (section.totalCount === 0) {
        return `
          <h2>${escHtml(section.statusLabel)} (0)</h2>
          <p class="note">No assets in this category.</p>
        `;
      }

      const rows = section.models
        .map(
          (m) => `<tr>
            <td>${escHtml(m.makeModel)}</td>
            <td class="num">${m.count}</td>
            <td class="assets">${m.assets
              .map((a) => {
                const sn = a.serialNumber
                  ? ` <span class="sn">(${escHtml(a.serialNumber)})</span>`
                  : "";
                return `${escHtml(a.assetName)}${sn}`;
              })
              .join(", ")}</td>
          </tr>`
        )
        .join("");

      return `
        <h2>${escHtml(section.statusLabel)} — ${section.totalCount} unit${section.totalCount === 1 ? "" : "s"}</h2>
        <table class="list breakdown">
          <thead>
            <tr>
              <th>Manufacturer / Model</th>
              <th class="num">Qty</th>
              <th>Assets</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total">
              <td><strong>Total</strong></td>
              <td class="num"><strong>${section.totalCount}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      `;
    })
    .join("");

  const bodyHtml = `
    <h1>${escHtml(input.title)}</h1>
    <p class="subtitle">${escHtml(input.subtitle)}</p>
    <p class="subtitle">Generated ${escHtml(input.generatedAt)}</p>
    <p class="note">Itemised breakdown of new stock, refurbished, and written-off assets grouped by manufacturer and model. Read alongside the Monthly Stock Reconcile Report.</p>
    ${sectionHtml}
    <p class="footer">Handicaps Network Africa Inventory · ${escHtml(input.title)}</p>
    <style>
      .breakdown th.num, .breakdown td.num { text-align: right; width: 40px; }
      .breakdown tr.total { background: #f0faf4; font-weight: bold; }
      .breakdown td.assets { font-size: 6.5px; color: #444; word-break: break-word; }
      .breakdown .sn { color: #888; font-size: 6px; }
      .note { font-size: 9pt; color: #555; margin: 8px 0; }
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
