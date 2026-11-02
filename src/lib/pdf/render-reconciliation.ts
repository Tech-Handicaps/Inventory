import {
  escHtml,
  htmlToPdfBuffer,
  logoBufferToDataUrl,
  pdfDocumentChrome,
} from "@/lib/pdf/chromium-pdf";
import { formatDate } from "@/lib/dates/format";
import { captureArithmetic, MODEL_ROW_NOTES } from "@/lib/reports/field-export";
import { monthLabelOf } from "@/lib/reports/period-catalog";
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
  const total = (key: "sameModel" | "otherModel") => bd.byModel.reduce((s, m) => s + m[key], 0);
  const a = captureArithmetic(report.register.hardware.deployed, capture.baseline.hnaOwned, bd);
  const arithmetic = `
    <h3>How the numbers add up</h3>
    <table class="list recon">
      <tbody>
        <tr><td><strong>HNA-owned terminals in the export</strong></td><td class="num"><strong>${a.hnaOwned}</strong></td></tr>
        <tr><td>Captured: matched to a Deployed unit at the same club</td><td class="num">${a.matched}</td></tr>
        <tr><td>Not yet captured</td><td class="num">${a.notCaptured}</td></tr>
        <tr><td><strong>Deployed in the register</strong></td><td class="num"><strong>${a.deployed}</strong></td></tr>
        <tr><td>Matched to an HNA-owned export terminal (captured)</td><td class="num">${a.matched}</td></tr>
        <tr><td>At sites not in the export</td><td class="num">${a.outsideExport}</td></tr>
        <tr><td>At clubs whose export rows are all club-owned or unowned</td><td class="num">${a.noHnaRows}</td></tr>
        <tr><td>Extra units at a club beyond its HNA-owned export rows</td><td class="num">${a.beyondExportCount}</td></tr>
      </tbody>
    </table>
    <p class="note">${a.matched} captured + ${a.notCaptured} not yet captured = ${a.hnaOwned} HNA-owned terminals. These are the only captured and not-yet-captured figures in this report: the headline and the model, club and month tables all use them. The ${a.notMatched} Deployed unit(s) that match no HNA-owned export terminal are listed below and are not counted as captured.</p>`;
  const unmatched = [
    ...bd.outsideExport.map((u) => `${escHtml(u.assetName)} – ${escHtml(u.model)} – ${escHtml(u.club ?? "no club recorded")} (site not in the export)`),
    ...bd.unmatchedAtClubs.map(
      (u) =>
        `${escHtml(u.assetName)} – ${escHtml(u.model)} – ${escHtml(u.club)} (${u.reason === "no_hna_rows" ? "export lists only club-owned or unowned terminals here" : "more units than HNA-owned export rows"})`
    ),
  ];
  const trend = report.captureTrend.points
    .map((p) => `<tr><td>${escHtml(monthLabelOf(p.monthKey))}${p.toDate ? ` <span class="muted">(to date)</span>` : ""}</td><td class="num">${p.captured}</td><td class="num">${p.pct}%</td></tr>`)
    .join("");
  const models = bd.byModel
    .map(
      (m) => `<tr><td>${escHtml(m.model)}${MODEL_ROW_NOTES[m.model] ? `<br /><span class="muted">${escHtml(MODEL_ROW_NOTES[m.model])}</span>` : ""}</td><td class="num">${m.inExport}</td><td class="num">${m.sameModel || "–"}</td><td class="num">${m.otherModel || "–"}</td><td class="num">${m.notYetCaptured || "–"}</td></tr>`
    )
    .join("");
  const clubs = bd.byClub
    .map(
      (c) => `<tr><td>${escHtml(c.clubId)}</td><td>${escHtml(c.club)}</td><td class="muted">${escHtml(c.exportModels || "None (club-owned only)")}</td><td class="num">${c.inExport}</td><td class="num">${c.captured}</td><td class="num">${c.notYetCaptured || "–"}</td></tr>`
    )
    .join("");
  const outside = unmatched.length
    ? `<p class="note">Deployed units that match no HNA-owned export terminal (${unmatched.length}): ${unmatched.join("; ")}.</p>`
    : "";
  return `
    ${arithmetic}
    <h3>Captured by month</h3>
    <table class="list recon">
      <thead><tr><th>Month end</th><th class="num">Captured</th><th class="num">% of HNA-owned</th></tr></thead>
      <tbody>${trend}</tbody>
    </table>
    <p class="note">At each month end (SAST): the hardware Deployed at that time, replayed for each asset from the audit log (which starts with the first asset on 18 April 2026), matched to the export with the same rule as above, using each unit's current club. The replay is checked against today's register. Deleted records are not counted.${report.captureTrend.unreconciled ? ` For ${report.captureTrend.unreconciled} asset(s) the replay does not end at today's status, so earlier months may be off by up to that number.` : ""}</p>
    <h3>By model</h3>
    <table class="list recon">
      <thead><tr><th>Model in the export</th><th class="num">HNA-owned in export</th><th class="num">Captured by the same model</th><th class="num">Captured by another model</th><th class="num">Not yet captured</th></tr></thead>
      <tbody>${models}<tr class="total"><td><strong>Total</strong></td><td class="num">${capture.baseline.hnaOwned}</td><td class="num">${total("sameModel")}</td><td class="num">${total("otherModel")}</td><td class="num">${capture.notYetCaptured}</td></tr></tbody>
    </table>
    <p class="note">Captured by the same model + by another model = ${capture.captured} captured. "Another model" means the club's terminal position is filled by a different model in the register${bd.crossModel.length ? ` (${escHtml(bd.crossModel.map((c) => `${c.count} ${c.exportModel} by ${c.registerModel}`).join(", "))})` : ""}; the register keeps the model it holds, nothing is merged or aliased. Lenovo M810z and Lenovo 10Q0 are different models. An NUC is counted once whichever screen it came with.</p>
    <h3>By club</h3>
    <p class="note">The register does not hold terminal IDs, so units are matched to the export by club (same model first). Clubs with only club-owned terminals are listed when the register has a unit there. Terminals not yet captured: ${bd.notCaptured.length} rows in the export, listed for technicians in the app.</p>
    <table class="list recon clubs">
      <thead><tr><th>Club ID</th><th>Club</th><th>HNA-owned terminals in export</th><th class="num">In export</th><th class="num">Captured</th><th class="num">Not yet</th></tr></thead>
      <tbody>${clubs}</tbody>
    </table>
    ${outside}
    <p class="note">Not counted towards the capture figure: ${capture.baseline.clubOwned} club-owned terminals (${escHtml(bd.clubOwnedByModel.map((m) => `${m.count} ${m.model}`).join(", "))})${bd.blankOwnership.length ? ` and ${bd.blankOwnership.length} with no owner recorded (${escHtml(bd.blankOwnership.map((t) => `${t.model} at ${t.club}`).join("; "))})` : ""}.</p>`;
}

function differenceHtml(report: ReconciliationView): string {
  const d = report.differenceBreakdown;
  if (d.difference === 0 && d.parts.length === 0) return "";
  const rows = d.parts
    .map(
      (p) => `<tr><td>${escHtml(p.label)}${p.items.length ? `<br />${escHtml(p.items.join(", "))}` : ""}<br /><span class="muted">${escHtml(p.note)}</span></td><td class="num">${signed(p.quantity)}</td><td>${p.status === "explained" ? "Explained" : "To be confirmed"}</td></tr>`
    )
    .join("");
  return `
    <h3>What makes up the difference of ${signed(d.difference)}</h3>
    <p class="note">After modems and card-reader brackets, the 31 January 2026 count leaves ${d.priorLeft} items. The bridge adds every Deployed unit on top of them, so the difference is what the register holds as stock and write-offs, set against those ${d.priorLeft} items model by model.${d.inRegister.length ? ` Found in the register as stock: ${escHtml(d.inRegister.join(", "))}.` : ""}</p>
    <table class="list recon">
      <thead><tr><th>Part</th><th class="num">Quantity</th><th>Status</th></tr></thead>
      <tbody>${rows}<tr class="total"><td><strong>Total = difference</strong></td><td class="num">${signed(d.parts.reduce((s, p) => s + p.quantity, 0))}</td><td></td></tr></tbody>
    </table>`;
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
    <p class="note">Lines are added in order. Whatever is left against the register is broken down below, part by part; it is not forced to balance.</p>
    <table class="list recon">
      <thead><tr><th>Section</th><th>Line</th><th class="num">Quantity</th><th class="num">Running total</th><th>Status</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total"><td colspan="3"><strong>Bridged total</strong></td><td class="num">${report.bridgedTotal}</td><td></td></tr>
        <tr class="total"><td colspan="3"><strong>System register (serialised assets)</strong></td><td class="num">${reg.total}</td><td></td></tr>
        <tr class="${report.unexplained === 0 ? "" : "warn"}"><td colspan="2"><strong>Difference to the register${report.unexplained === 0 ? "" : " – broken down below"}</strong></td><td class="num">${signed(report.unexplained)}</td><td></td><td>${report.unexplained === 0 ? "Balanced" : "See breakdown"}</td></tr>
      </tbody>
    </table>
    ${differenceHtml(report)}

    <h2>The register</h2>
    <p class="note">${reg.total} = ${reg.hardware.total} hardware (${reg.hardware.newStock} new, ${reg.hardware.refurbished} refurbished, ${reg.hardware.deployed} deployed, ${reg.hardware.assessment} in assessment, ${reg.hardware.repair} in repair, ${reg.hardware.writtenOff} written off) + ${reg.usbReaders} USB readers${reg.other ? ` + ${reg.other} other` : ""}. Written off with a disposal certificate: ${reg.writtenOffWithCertificate}; pending disposal: ${reg.pendingDisposal}.</p>

    <h2>Field capture in progress</h2>
    <p class="note">Measured against the field terminal export dated ${escHtml(formatDate(capture.baseline.exportDate))} (${escHtml(capture.baseline.fileName)}): ${capture.baseline.terminalsAtClubs} terminals at ${capture.baseline.clubIds} clubs – ${capture.baseline.hnaOwned} HNA-owned, ${capture.baseline.clubOwned} club-owned, ${capture.baseline.blankOwnership} with no owner recorded. Club-owned and unowned rows do not count towards the capture figure.</p>
    <table class="list recon">
      <thead><tr><th>HNA-owned terminals</th><th class="num">Captured</th><th class="num">Not yet captured</th><th class="num">% captured</th></tr></thead>
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
