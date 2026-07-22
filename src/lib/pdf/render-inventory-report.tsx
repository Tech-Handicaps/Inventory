import {
  escHtml,
  escOptional,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import type { PdfAssetRow } from "@/lib/pdf/inventory-report-document";

export type InventoryReportPdfInput = {
  title: string;
  subtitle: string;
  generatedAt: string;
  logoSource: Buffer | string | null;
  summaryRows: { label: string; value: string }[];
  rows: PdfAssetRow[];
};

export async function renderInventoryReportPdf(
  input: InventoryReportPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);

  const summary = input.summaryRows
    .map(
      (s) =>
        `<div class="summary-cell"><div class="summary-label">${escHtml(s.label)}</div><div class="summary-value">${escHtml(s.value)}</div></div>`
    )
    .join("");

  const rows = input.rows
    .map(
      (r) => `<tr>
      <td>${escHtml(r.assetName)}</td>
      <td>${escHtml(r.category)}</td>
      <td>${escOptional(r.manufacturer)}</td>
      <td>${escOptional(r.model)}</td>
      <td>${escOptional(r.serialNumber)}</td>
      <td>${escHtml(r.statusLabel)}</td>
      <td>${escHtml(r.dateUpdated)}</td>
    </tr>`
    )
    .join("");

  const bodyHtml = `
    <h1>${escHtml(input.title)}</h1>
    <p class="subtitle">${escHtml(input.subtitle)}</p>
    <p class="subtitle">Generated ${escHtml(input.generatedAt)}</p>
    <div class="summary">${summary}</div>
    <h2>Assets</h2>
    <table class="list">
      <thead>
        <tr>
          <th>Name</th><th>Type</th><th>Mfr</th><th>Model</th>
          <th>Serial</th><th>Status</th><th>Updated</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="7">No assets in this report.</td></tr>`}</tbody>
    </table>
    <p class="footer">Handicaps Network Africa Inventory · ${escHtml(input.title)}</p>
  `;

  return htmlToPdfBuffer(
    pdfDocumentChrome({
      title: input.title,
      bodyHtml,
      logoDataUrl,
    })
  );
}
