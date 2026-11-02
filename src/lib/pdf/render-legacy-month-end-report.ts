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
import { periodInfo } from "@/lib/reports/period-catalog";

export type LegacyPdfEvent = {
  eventDate: string;
  documentDate: string | null;
  description: string;
  assetLabel: string;
  serials: string[];
  fromLocation: string;
  toLocation: string;
  reference: string;
  evidenceFileName: string;
  notes: string | null;
};

export type LegacyPdfDocument = {
  title: string;
  fileName: string;
  sha256: string;
  flag: string | null;
};

export type LegacyMonthEndPdfInput = {
  events?: LegacyPdfEvent[];
  documents?: LegacyPdfDocument[];
  /** Notes for auditors and finance, printed as page 1. */
  prefaceHtml?: string | null;
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

  const period = periodInfo(draft.monthKey);
  const sourceLine =
    draft.sourceKind === "source_file"
      ? `Source file: ${draft.sourceFileName ?? "prior-company workbook"}`
      : `Quantities carried forward from the ${monthKeyLabel(draft.carriedForwardFromMonthKey ?? "")} count. No count was taken this month.`;
  const memoLines = draft.lines.filter((line) => line.memo);

  const bodyHtml = `
    <h1>Prior company month-end stock</h1>
    <p class="ref">${escHtml(label)} – ${escHtml(period.title)}</p>
    <p class="subtitle">Quantity record for accounts and audit. Generated ${escHtml(input.generatedAt)}</p>
    ${period.detail ? `<p class="note">${escHtml(period.detail)}</p>` : ""}
    <p class="note">${escHtml(sourceLine)}</p>
    <p class="note">${escHtml(draft.notes)}</p>
    <p class="note">Categories: New → New. Repaired/Used → Refurbished. To assess → Assessment/Maintenance. To dispose → Written off only with a disposal certificate, otherwise Pending disposal. Warranty repair is kept on its own. Usable = New + Repaired/Used.</p>
    ${documentsHtml(input.documents ?? [])}

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
    ${memoLines.length ? `<p class="note">Memo lines (grey, marked "memo") are shown as on the form and are not in any total.</p>` : ""}
    ${eventsHtml(input.events ?? [])}
    <p class="footer">Handicaps Network Africa Inventory · Prior company month-end stock · ${escHtml(label)}</p>
    <style>
      .legacy th.num, .legacy td.num { text-align: right; white-space: nowrap; }
      .legacy tr.total, .legacy tr.group { background: #f0faf4; font-weight: bold; }
      .legacy tr.group td { padding-top: 8px; }
      .note { font-size: 9px; color: #333; margin: 0 0 8px 0; }
      .legacy tr.quiet td { color: #888; font-weight: normal; }
      .legacy tr.memo td { color: #888; font-style: italic; }
      h1 { font-size: 16px; }
    </style>
  `;

  return htmlToPdfBuffer(
    pdfDocumentChrome({
      prefaceHtml: input.prefaceHtml,
      title: `Prior company month-end stock — ${label}`,
      bodyHtml,
      watermarkText: period.watermark,
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
  const rowClass = line.memo ? "memo" : legacyLineUnits(line) === 0 ? "quiet" : "";
  return `<tr class="${rowClass}">
    <td>${escHtml(name)}${line.memo ? " (memo)" : ""}</td>
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

function documentsHtml(documents: LegacyPdfDocument[]): string {
  if (documents.length === 0) return "";
  const rows = documents
    .map(
      (doc) => `<tr>
        <td>${escHtml(doc.title)}${doc.flag ? `<br /><em>${escHtml(doc.flag)}</em>` : ""}</td>
        <td>${escHtml(doc.fileName)}</td>
        <td class="hash">${escHtml(doc.sha256)}</td>
      </tr>`
    )
    .join("");
  return `<h2>Attached source files</h2>
    <table class="list legacy">
      <thead><tr><th>Document</th><th>File</th><th>SHA-256</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <style>.legacy td.hash { font-family: monospace; font-size: 6px; word-break: break-all; }</style>`;
}

function eventsHtml(events: LegacyPdfEvent[]): string {
  if (events.length === 0) return "";
  const rows = events
    .map(
      (event) => `<tr>
        <td>${escHtml(event.eventDate)}${event.documentDate ? `<br />Document ${escHtml(event.documentDate)}` : ""}</td>
        <td>${escHtml(event.description)}${event.notes ? `<br /><em>${escHtml(event.notes)}</em>` : ""}</td>
        <td>${escHtml(event.assetLabel)}</td>
        <td>${escHtml(event.serials.join(" / "))}</td>
        <td>${escHtml(event.fromLocation)} → ${escHtml(event.toLocation)}</td>
        <td>${escHtml(event.reference)}</td>
        <td>${escHtml(event.evidenceFileName)}</td>
      </tr>`
    )
    .join("");
  return `<h2>Movements in this period</h2>
    <p class="note">From the prior company's vouchers and movement report. Event date first; the document date is shown when the voucher was issued later.</p>
    <table class="list legacy">
      <thead><tr><th>Date</th><th>Event</th><th>Asset</th><th>Serial</th><th>From → To</th><th>Ref</th><th>Evidence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
