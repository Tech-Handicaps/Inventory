import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import type { AuditorIndex } from "@/lib/reports/auditor-index";

export type AuditorIndexPdfInput = {
  index: AuditorIndex;
  generatedAt: string;
  logoSource: Buffer | string | null;
};

export async function renderAuditorIndexPdf(
  input: AuditorIndexPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);
  const paragraphs = input.index.paragraphs
    .map((paragraph) => `<p class="note">${escHtml(paragraph)}</p>`)
    .join("");
  const rows = input.index.entries
    .map(
      (entry) => `<tr>
        <td>${escHtml(entry.title)}</td>
        <td>${escHtml(entry.covers)}</td>
      </tr>`
    )
    .join("");
  const bodyHtml = `
    <h1>${escHtml(input.index.title)}</h1>
    <p class="subtitle">First page of the accountant file. Generated ${escHtml(input.generatedAt)}</p>
    ${paragraphs}
    <table class="list">
      <thead>
        <tr>
          <th>Open this</th>
          <th>What it covers</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="footer">Handicaps Network Africa Inventory · Auditor index · the two series are not added</p>
    <style>
      .note { font-size: 9px; color: #333; margin: 0 0 8px 0; line-height: 1.45; }
      h1 { font-size: 16px; }
      td:first-child { font-weight: 600; white-space: nowrap; vertical-align: top; }
    </style>
  `;
  return htmlToPdfBuffer(
    pdfDocumentChrome({
      title: input.index.title,
      bodyHtml,
      logoDataUrl,
    })
  );
}
