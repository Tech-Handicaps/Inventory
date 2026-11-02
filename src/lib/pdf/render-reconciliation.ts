import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { formatDate } from "@/lib/dates/format";
import { RECON_SECTIONS, type ReconSection } from "@/lib/reports/reconciliation";
import type { ReconciliationView } from "@/lib/reports/load-reconciliation";

export type ReconciliationPdfInput = {
  /** Notes for auditors and finance, printed as page 1. */
  prefaceHtml?: string | null;
  report: ReconciliationView;
  handoverBasis: string | null;
  generatedAt: string;
  logoSource: Buffer | string | null;
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function fieldCaptureBreakdownHtml(report: ReconciliationView): string {
  const capture = report.fieldCapture;
  const bd = capture.breakdown;
  if (!bd) return `<p class="note">The stored export could not be read, so the breakdown by model and club is not included.</p>`;
  const modelGap = bd.byModel.reduce((s, m) => s + m.notYetCaptured, 0);
  const beyond = bd.byModel.reduce((s, m) => s + m.beyondExport, 0);
  const models = bd.byModel
    .map(
      (m) => `<tr><td>${escHtml(m.model)}${m.inExport === 0 ? ` <span class="muted">(not named in the export)</span>` : ""}</td><td class="num">${m.inExport}</td><td class="num">${m.captured}</td><td class="num">${m.notYetCaptured || "–"}</td></tr>`
    )
    .join("");
  const clubs = bd.byClub
    .map(
      (c) => `<tr><td>${escHtml(c.clubId)}</td><td>${escHtml(c.club)}</td><td class="muted">${escHtml(c.exportModels || "None (club-owned only)")}</td><td class="num">${c.inExport}</td><td class="num">${c.captured}</td><td class="num">${c.notYetCaptured || "–"}</td></tr>`
    )
    .join("");
  const outside = bd.outsideExport.length
    ? `<p class="note">Deployed at sites not in this export (${bd.outsideExport.length}): ${bd.outsideExport
        .map((u) => `${escHtml(u.assetName)} – ${escHtml(u.model)} – ${escHtml(u.club ?? "no club recorded")}`)
        .join("; ")}.</p>`
    : "";
  return `
    <h3>By model</h3>
    <table class="list recon">
      <thead><tr><th>Model</th><th class="num">HNA-owned in export</th><th class="num">Captured (Deployed)</th><th class="num">Not yet captured</th></tr></thead>
      <tbody>${models}<tr class="total"><td><strong>Total</strong></td><td class="num">${capture.baseline.hnaOwned}</td><td class="num">${report.register.hardware.deployed}</td><td class="num">${modelGap}</td></tr></tbody>
    </table>
    <p class="note">Lenovo M810z and Lenovo 10Q0 are kept as separate models: the export names M810z, the register's Lenovo units are 10Q0. An NUC is counted once whichever screen it came with.${modelGap !== capture.notYetCaptured ? ` Per model the gaps add up to ${modelGap} rather than ${capture.notYetCaptured}, because ${beyond} deployed unit(s) are models the export does not name, or more units of a model than the export lists.` : ""}</p>
    <h3>By club</h3>
    <p class="note">The register does not hold terminal IDs, so units are matched to the export by club (same model first). Clubs with only club-owned terminals are listed when the register has a unit there. Terminals not yet captured: ${bd.notCaptured.length} rows in the export, listed for technicians in the app.</p>
    <table class="list recon clubs">
      <thead><tr><th>Club ID</th><th>Club</th><th>HNA-owned terminals in export</th><th class="num">In export</th><th class="num">Captured</th><th class="num">Not yet</th></tr></thead>
      <tbody>${clubs}</tbody>
    </table>
    ${outside}
    <p class="note">Not counted towards the capture figure: ${capture.baseline.clubOwned} club-owned terminals (${escHtml(bd.clubOwnedByModel.map((m) => `${m.count} ${m.model}`).join(", "))})${bd.blankOwnership.length ? ` and ${bd.blankOwnership.length} with no owner recorded (${escHtml(bd.blankOwnership.map((t) => `${t.model} at ${t.club}`).join("; "))})` : ""}.</p>`;
}

export async function renderReconciliationPdf(input: ReconciliationPdfInput): Promise<Buffer> {
  const logoDataUrl =
    typeof input.logoSource === "string" ? input.logoSource : logoBufferToDataUrl(input.logoSource);
  const { report } = input;
  const reg = report.register;
  const capture = report.fieldCapture;

  const rows = report.lines
    .map(
      (line, index) => `<tr>
        <td>${escHtml(RECON_SECTIONS[line.section as ReconSection] ?? line.section)}</td>
        <td>${escHtml(line.label)}${line.notes ? `<br /><span class="muted">${escHtml(line.notes)}</span>` : ""}</td>
        <td class="num">${escHtml(index === 0 ? String(line.quantity) : signed(line.quantity))}</td>
        <td class="num">${line.runningTotal}</td>
        <td>${line.status === "confirmed" ? "Confirmed" : "To be confirmed"}</td>
      </tr>`
    )
    .join("");

  const bodyHtml = `
    <h1>Reconciliation: prior count to system register</h1>
    <p class="subtitle">Generated ${escHtml(input.generatedAt)}</p>
    ${input.handoverBasis ? `<p class="note">${escHtml(input.handoverBasis)}</p>` : ""}
    <p class="note">Lines are added in order. Whatever is left against the register is shown as "to be confirmed"; it is not forced to balance.</p>
    <table class="list recon">
      <thead><tr><th>Section</th><th>Line</th><th class="num">Quantity</th><th class="num">Running total</th><th>Status</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total"><td colspan="3"><strong>Bridged total</strong></td><td class="num">${report.bridgedTotal}</td><td></td></tr>
        <tr class="${report.unexplained === 0 ? "" : "warn"}"><td colspan="2"><strong>Difference to the register – to be confirmed</strong></td><td class="num">${signed(report.unexplained)}</td><td></td><td>To be confirmed</td></tr>
        <tr class="total"><td colspan="3"><strong>System register (serialised assets)</strong></td><td class="num">${reg.total}</td><td></td></tr>
      </tbody>
    </table>

    <h2>The register</h2>
    <p class="note">${reg.total} = ${reg.hardware.total} hardware (${reg.hardware.newStock} new, ${reg.hardware.refurbished} refurbished, ${reg.hardware.deployed} deployed, ${reg.hardware.assessment} in assessment, ${reg.hardware.repair} in repair, ${reg.hardware.writtenOff} written off) + ${reg.usbReaders} USB readers${reg.other ? ` + ${reg.other} other` : ""}. Written off with a disposal certificate: ${reg.writtenOffWithCertificate}; pending disposal: ${reg.pendingDisposal}.</p>

    <h2>Field capture in progress</h2>
    <p class="note">Measured against the field terminal export dated ${escHtml(formatDate(capture.baseline.exportDate))} (${escHtml(capture.baseline.fileName)}): ${capture.baseline.terminalsAtClubs} terminals at ${capture.baseline.clubIds} clubs – ${capture.baseline.hnaOwned} HNA-owned, ${capture.baseline.clubOwned} club-owned, ${capture.baseline.blankOwnership} with no owner recorded. Club-owned and unowned rows do not count towards the capture figure.</p>
    <table class="list recon">
      <thead><tr><th>HNA-owned terminals</th><th class="num">Captured (Deployed)</th><th class="num">Not yet captured</th><th class="num">% captured</th></tr></thead>
      <tbody><tr><td>${capture.baseline.hnaOwned}</td><td class="num">${capture.captured}</td><td class="num">${capture.notYetCaptured}</td><td class="num">${capture.capturedPct}%</td></tr></tbody>
    </table>
    <p class="note">This is field capture in progress, not a loss or a variance.</p>
    ${fieldCaptureBreakdownHtml(report)}
    <p class="footer">Handicaps Network Africa Inventory · Reconciliation: prior count to system register</p>
    <style>
      .note { font-size: 9px; color: #333; margin: 0 0 8px 0; line-height: 1.45; }
      .muted { color: #666; }
      .recon th.num, .recon td.num { text-align: right; white-space: nowrap; }
      .recon tr.total { background: #f0faf4; }
      .recon tr.warn { background: #fff7e6; }
      .recon.clubs td, .recon.clubs th { font-size: 8px; padding-top: 2px; padding-bottom: 2px; }
      h3 { font-size: 11px; margin: 10px 0 4px 0; }
      h1 { font-size: 16px; }
    </style>
  `;
  return htmlToPdfBuffer(
    pdfDocumentChrome({
      prefaceHtml: input.prefaceHtml,
      title: "Reconciliation: prior count to system register",
      bodyHtml,
      logoDataUrl,
    })
  );
}
