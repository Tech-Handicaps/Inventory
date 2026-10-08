import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { type StockHandover } from "@/lib/reports/stock-handover";

export type StockHandoverPdfInput = {
  handover: StockHandover;
  generatedAt: string;
  logoSource: Buffer | string | null;
};

function eventRow(event: StockHandover["events"][number]): string {
  return `<tr>
    <td>${escHtml(event.dateLabel)}</td>
    <td>${escHtml(event.series)}</td>
    <td>${escHtml(event.statement)}</td>
  </tr>`;
}

function outcomeHtml(outcome: StockHandover["outcomes"][number]): string {
  const rows = outcome.lines
    .map(
      (line) => `<tr>
        <td>${escHtml(line.name)}</td>
        <td>${escHtml(line.note)}</td>
      </tr>`
    )
    .join("");
  return `
    <h2>${escHtml(outcome.title)}</h2>
    <p class="note">${escHtml(outcome.statement)}</p>
    <table class="list audit">
      <thead>
        <tr>
          <th>Name</th>
          <th>Where it is counted</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function renderStockHandoverPdf(
  input: StockHandoverPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);
  const { handover } = input;
  const paragraphs = handover.paragraphs
    .map((paragraph) => `<p class="note">${escHtml(paragraph)}</p>`)
    .join("");

  const bodyHtml = `
    <h1>${escHtml(handover.title)}</h1>
    <p class="ref">Prior-company stock takes and this system's register. The two totals are not combined.</p>
    <p class="subtitle">For auditors and accounts. Generated ${escHtml(input.generatedAt)}</p>
    ${paragraphs}
    <h2>Dates</h2>
    <table class="list audit">
      <thead>
        <tr>
          <th>Date</th>
          <th>Series</th>
          <th>What it records</th>
        </tr>
      </thead>
      <tbody>
        ${handover.events.map(eventRow).join("")}
      </tbody>
    </table>
    <h2>How the lines are sorted</h2>
    <p class="note">Each prior-company line is either named on both sides or quantity only. Register-only rows were never on the workbook. The two series are not added.</p>
    ${handover.outcomes.map(outcomeHtml).join("")}
    <p class="footer">Handicaps Network Africa Inventory · Stock report handover · Prior company through 31 December 2025 · This system from 18 April 2026</p>
    <style>
      .note { font-size: 10px; color: #333; margin: 0 0 8px 0; line-height: 1.45; }
      h1 { font-size: 16px; }
      h2 { margin-top: 14px; }
      .audit td { vertical-align: top; }
    </style>
  `;

  return htmlToPdfBuffer(
    pdfDocumentChrome({
      title: handover.title,
      bodyHtml,
      logoDataUrl,
      landscape: true,
    }),
    { landscape: true }
  );
}
