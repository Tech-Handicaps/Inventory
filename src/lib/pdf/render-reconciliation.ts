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
    <p class="note">Measured against the field terminal export dated ${escHtml(formatDate(capture.baseline.exportDate))} (${escHtml(capture.baseline.fileName)}): ${capture.baseline.terminalsAtClubs} terminals at clubs – ${capture.baseline.hnaOwned} HNA-owned, ${capture.baseline.clubOwned} club-owned, ${capture.baseline.blankOwnership} with blank ownership. Club-owned and blank rows do not count towards the capture figure.</p>
    <table class="list recon">
      <thead><tr><th>HNA-owned terminals</th><th class="num">Captured (Deployed)</th><th class="num">Not yet captured</th><th class="num">% captured</th></tr></thead>
      <tbody><tr><td>${capture.baseline.hnaOwned}</td><td class="num">${capture.captured}</td><td class="num">${capture.notYetCaptured}</td><td class="num">${capture.capturedPct}%</td></tr></tbody>
    </table>
    <p class="note">This is field capture in progress, not a loss or a variance.</p>
    <p class="footer">Handicaps Network Africa Inventory · Reconciliation: prior count to system register</p>
    <style>
      .note { font-size: 9px; color: #333; margin: 0 0 8px 0; line-height: 1.45; }
      .muted { color: #666; }
      .recon th.num, .recon td.num { text-align: right; white-space: nowrap; }
      .recon tr.total { background: #f0faf4; }
      .recon tr.warn { background: #fff7e6; }
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
