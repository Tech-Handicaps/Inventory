import {
  escHtml,
  escOptional,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { ALL_REPORT_ASSET_TYPES } from "@/lib/reports/asset-types";
import type { FinanceFieldUnit } from "@/lib/reports/finance-month-pack";

export type FinanceFieldListingPdfInput = {
  monthEndingLabel: string;
  units: FinanceFieldUnit[];
  generatedAt: string;
  logoSource: Buffer | string | null;
};

function section(label: string, units: FinanceFieldUnit[]): string {
  const rows =
    units.length === 0
      ? `<tr><td colspan="3">None</td></tr>`
      : units
          .map(
            (unit) => `<tr>
              <td>${escHtml(unit.manufacturer)}</td>
              <td>${escHtml(unit.model)}</td>
              <td>${escOptional(unit.serialNumber)}</td>
            </tr>`
          )
          .join("");
  return `<h2>${escHtml(label)} — ${units.length}</h2>
    <table class="list">
      <thead>
        <tr>
          <th>Make</th>
          <th>Model</th>
          <th>Serial</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export async function renderFinanceFieldListingPdf(
  input: FinanceFieldListingPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);
  const sections = ALL_REPORT_ASSET_TYPES.map((type) =>
    section(
      type.label,
      input.units.filter((unit) => unit.assetType === type.id)
    )
  ).join("");
  const bodyHtml = `
    <h1>Deployed field listing</h1>
    <p class="subtitle">${escHtml(input.monthEndingLabel)}. Generated ${escHtml(input.generatedAt)}</p>
    <p class="note">These are the deployed units at the scheduled send. This file is kept with that month. It is not a live library print.</p>
    <p class="note">Hardware, USB HID Magnetic Stripe Readers, and other stay in separate sections and are not added together. The monthly reconcile and stock breakdown sent to finance are unchanged and do not list these serials.</p>
    ${sections}
    <p class="footer">Handicaps Network Africa Inventory · Deployed field listing · taken at send time</p>
    <style>
      .note { font-size: 9px; color: #333; margin: 0 0 8px 0; line-height: 1.4; }
      h1 { font-size: 16px; }
      h2 { margin-top: 14px; font-size: 12px; }
    </style>
  `;
  return htmlToPdfBuffer(
    pdfDocumentChrome({
      title: "Deployed field listing",
      bodyHtml,
      logoDataUrl,
    })
  );
}
