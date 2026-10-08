import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import {
  FINANCE_MONTH_ON_MONTH_COLUMNS,
  formatFinanceChange,
  type FinanceModelMovement,
  type FinanceMonthOnMonthReport,
  type FinanceMonthOnMonthRow,
  type FinanceTypeBlock,
  type FinanceTypeMonthRow,
} from "@/lib/reports/finance-month-on-month";

export type FinanceMonthOnMonthPdfInput = {
  report: FinanceMonthOnMonthReport;
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

function monthRow(row: FinanceMonthOnMonthRow): string {
  return `<tr>
    <td>${escHtml(row.monthEndingLabel)}</td>
    ${num(row.newStock)}
    ${num(row.refurbished)}
    ${num(row.usable)}
    ${num(row.deployed)}
    ${num(row.assessment)}
    ${num(row.inRepair)}
    ${num(row.writtenOff)}
    ${num(row.register)}
    ${signed(row.usableChange)}
    ${signed(row.registerChange)}
  </tr>`;
}

function typeMonthRow(row: FinanceTypeMonthRow): string {
  return `<tr>
    <td>${escHtml(row.monthEndingLabel)}</td>
    ${num(row.newStock)}
    ${num(row.refurbished)}
    ${num(row.usable)}
    ${num(row.deployed)}
    ${num(row.assessment)}
    ${num(row.inRepair)}
    ${num(row.writtenOff)}
    ${num(row.register)}
    ${signed(row.usableChange)}
    ${signed(row.registerChange)}
  </tr>`;
}

function typeBlockTable(
  block: FinanceTypeBlock,
  headers: readonly string[]
): string {
  const [newStock, refurbished, usable, deployed, assessment, inRepairs, writtenOff, register, usableChange, registerChange] =
    headers;
  return `<h2>${escHtml(block.label)}</h2>
    <table class="list audit">
      <thead>
        <tr>
          <th>Month ending</th>
          <th class="num">${escHtml(newStock)}</th>
          <th class="num">${escHtml(refurbished)}</th>
          <th class="num">${escHtml(usable)}</th>
          <th class="num">${escHtml(deployed)}</th>
          <th class="num">${escHtml(assessment)}</th>
          <th class="num">${escHtml(inRepairs)}</th>
          <th class="num">${escHtml(writtenOff)}</th>
          <th class="num">${escHtml(register)}</th>
          <th class="num">${escHtml(usableChange)}</th>
          <th class="num">${escHtml(registerChange)}</th>
        </tr>
      </thead>
      <tbody>
        ${block.months.map(typeMonthRow).join("")}
      </tbody>
    </table>`;
}

function movementRow(movement: FinanceModelMovement): string {
  return `<tr>
    <td>${escHtml(movement.monthEndingLabel)}</td>
    <td>${escHtml(movement.makeModel)}</td>
    <td>${escHtml(movement.statusLabel)}</td>
    ${num(movement.previous)}
    ${num(movement.current)}
    ${signed(movement.delta)}
  </tr>`;
}

export async function renderFinanceMonthOnMonthPdf(
  input: FinanceMonthOnMonthPdfInput
): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string"
      ? input.logoSource
      : logoBufferToDataUrl(input.logoSource);
  const { report } = input;
  const introduction = report.introduction
    .map((paragraph) => `<p class="note">${escHtml(paragraph)}</p>`)
    .join("");
  const [newStock, refurbished, usable, deployed, assessment, inRepairs, writtenOff, register, usableChange, registerChange] =
    FINANCE_MONTH_ON_MONTH_COLUMNS;

  const monthTable =
    report.months.length === 0
      ? ""
      : `<h2>Stored finance months</h2>
    <table class="list audit">
      <thead>
        <tr>
          <th>Month ending</th>
          <th class="num">${escHtml(newStock)}</th>
          <th class="num">${escHtml(refurbished)}</th>
          <th class="num">${escHtml(usable)}</th>
          <th class="num">${escHtml(deployed)}</th>
          <th class="num">${escHtml(assessment)}</th>
          <th class="num">${escHtml(inRepairs)}</th>
          <th class="num">${escHtml(writtenOff)}</th>
          <th class="num">${escHtml(register)}</th>
          <th class="num">${escHtml(usableChange)}</th>
          <th class="num">${escHtml(registerChange)}</th>
        </tr>
      </thead>
      <tbody>
        ${report.months.map(monthRow).join("")}
      </tbody>
    </table>`;

  const typeTables =
    report.typeBlocks.length === 0
      ? ""
      : `<h2>Asset types</h2>
    <p class="note">${escHtml(report.typeNote)}</p>
    ${report.typeBlocks.map((block) => typeBlockTable(block, FINANCE_MONTH_ON_MONTH_COLUMNS)).join("")}`;

  const movementBody =
    report.movements.length === 0
      ? report.months.length < 2
        ? "The first stored month has no previous position to compare."
        : "No make or model count changed from one stored month to the next."
      : "";
  const movementTable =
    report.months.length === 0
      ? ""
      : `<h2>Make and model changes</h2>
    <p class="note">${escHtml(report.movementNote)}</p>
    ${
      report.movements.length === 0
        ? `<p class="note">${escHtml(movementBody)}</p>`
        : `<table class="list audit">
      <thead>
        <tr>
          <th>Month</th>
          <th>Make / model</th>
          <th>Status</th>
          <th class="num">Previous stored</th>
          <th class="num">This month</th>
          <th class="num">Change</th>
        </tr>
      </thead>
      <tbody>
        ${report.movements.map(movementRow).join("")}
      </tbody>
    </table>`
    }`;

  const bodyHtml = `
    <h1>Finance month-on-month</h1>
    <p class="subtitle">Official finance packs only. Generated ${escHtml(input.generatedAt)}</p>
    ${introduction}
    ${monthTable}
    ${typeTables}
    ${movementTable}
    <p class="footer">Handicaps Network Africa Inventory · Finance month-on-month · stored official packs only</p>
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
      title: "Finance month-on-month",
      bodyHtml,
      logoDataUrl,
      landscape: true,
    }),
    { landscape: true }
  );
}
