import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { legacyCompositionHtml } from "@/lib/pdf/render-legacy-month-end-report";
import {
  formatSigned,
  type LineMovement,
  type MonthOnMonthAudit,
  type MonthOnMonthRow,
} from "@/lib/reports/month-on-month-audit";

export type MonthOnMonthPdfInput = {
  audit: MonthOnMonthAudit;
  generatedAt: string;
  logoSource: Buffer | string | null;
};

function num(value: number): string {
  return `<td class="num">${escHtml(String(value))}</td>`;
}

function signed(value: number | null): string {
  if (value === null) return `<td class="num">—</td>`;
  const cls = value > 0 ? "up" : value < 0 ? "down" : "";
  return `<td class="num ${cls}">${escHtml(formatSigned(value))}</td>`;
}

function monthRow(row: MonthOnMonthRow): string {
  return `<tr>
    <td>${escHtml(row.label)}</td>
    <td>${escHtml(row.sourceLabel)}</td>
    ${num(row.totals.newStock)}
    ${num(row.totals.repairedUsed)}
    ${num(row.totals.usable)}
    ${num(row.totals.toAssess)}
    ${num(row.totals.toDispose)}
    ${num(row.totals.warrantyRepair)}
    ${num(row.totals.units)}
    ${signed(row.delta?.units ?? null)}
    <td>${escHtml(row.movementNote)}</td>
  </tr>`;
}

function movementRow(movement: LineMovement): string {
  const name = [movement.manufacturer, movement.model].filter(Boolean).join(" ");
  return `<tr>
    <td>${escHtml(movement.toLabel)}</td>
    <td>${escHtml(name)}</td>
    <td>${escHtml(movement.category)}</td>
    <td>${escHtml(movement.column)}</td>
    ${num(movement.previous)}
    ${num(movement.current)}
    ${signed(movement.delta)}
  </tr>`;
}

export async function renderMonthOnMonthAuditPdf(
  input: MonthOnMonthPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);
  const { audit } = input;
  const first = audit.months[0]?.label ?? "October 2025";
  const last = audit.months[audit.months.length - 1]?.label ?? "March 2026";
  const explanation = audit.explanation
    .map((paragraph) => `<p class="note">${escHtml(paragraph)}</p>`)
    .join("");
  const movementBody =
    audit.movements.length === 0
      ? `<tr><td colspan="7">No quantity changed from one month to the next.</td></tr>`
      : audit.movements.map(movementRow).join("");

  const bodyHtml = `
    <h1>Prior-company month-on-month</h1>
    <p class="ref">${escHtml(first)} through ${escHtml(last)}. Workbook quantities only. The live register is not on this report.</p>
    <p class="subtitle">For auditors and accounts. Generated ${escHtml(input.generatedAt)}</p>
    ${explanation}

    <h2>Month-end totals and movement</h2>
    <table class="list audit">
      <thead>
        <tr>
          <th>Month ending</th>
          <th>Source</th>
          <th class="num">New</th>
          <th class="num">Repaired/Used</th>
          <th class="num">Usable</th>
          <th class="num">To assess</th>
          <th class="num">To dispose</th>
          <th class="num">Warranty</th>
          <th class="num">Units</th>
          <th class="num">Units vs prior</th>
          <th>What changed</th>
        </tr>
      </thead>
      <tbody>
        ${audit.months.map(monthRow).join("")}
      </tbody>
    </table>

    <h2>What the prior-company totals are made of</h2>
    <p class="note">Shown once for each month whose mix changes. Later copied months repeat the last mix. These lines are quantity counts from the workbooks, not serialised assets.</p>
    ${audit.stockBreakdowns
      .map(
        (block) =>
          `<h3>${escHtml(block.label)}</h3>${legacyCompositionHtml(block.columns)}`
      )
      .join("")}

    <h2>Line movements</h2>
    <table class="list audit">
      <thead>
        <tr>
          <th>Month</th>
          <th>Make / model</th>
          <th>Type</th>
          <th>Column</th>
          <th class="num">Previous</th>
          <th class="num">Current</th>
          <th class="num">Change</th>
        </tr>
      </thead>
      <tbody>
        ${movementBody}
      </tbody>
    </table>
    <p class="footer">Handicaps Network Africa Inventory · Prior-company month-on-month · October 2025 through March 2026</p>
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
      title: "Prior-company month-on-month",
      bodyHtml,
      logoDataUrl,
      landscape: true,
    }),
    { landscape: true }
  );
}
