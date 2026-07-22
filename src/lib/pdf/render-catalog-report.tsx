import {
  escHtml,
  escOptional,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import type { PdfCatalogRow } from "@/lib/pdf/catalog-report-document";

export type CatalogReportPdfInput = {
  title: string;
  subtitle: string;
  generatedAt: string;
  logoSource: Buffer | string | null;
  summaryRows: { label: string; value: string }[];
  rows: PdfCatalogRow[];
};

export async function renderCatalogReportPdf(
  input: CatalogReportPdfInput
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
      <td>${escHtml(r.label)}</td>
      <td>${escHtml(r.manufacturer)}</td>
      <td>${escHtml(r.model)}</td>
      <td>${escHtml(r.category)}</td>
      <td>${escOptional(r.notes)}</td>
      <td>${escHtml(r.updatedAt)}</td>
    </tr>`
    )
    .join("");

  const bodyHtml = `
    <h1>${escHtml(input.title)}</h1>
    <p class="subtitle">${escHtml(input.subtitle)}</p>
    <p class="subtitle">Generated ${escHtml(input.generatedAt)}</p>
    <div class="summary">${summary}</div>
    <h2>Templates</h2>
    <table class="list">
      <thead>
        <tr>
          <th>Label</th><th>Manufacturer</th><th>Model</th>
          <th>Category</th><th>Notes</th><th>Updated</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="6">No templates.</td></tr>`}</tbody>
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
