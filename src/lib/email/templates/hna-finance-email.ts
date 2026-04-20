const BRAND = "#139d4b";
const MUTED = "#555555";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function wrapHnaEmailHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
          <tr>
            <td style="height:4px;background:${BRAND};"></td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;">
              <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED};">Handicaps Network Africa</p>
              <p style="margin:6px 0 0 0;font-size:16px;font-weight:bold;color:#111;">Inventory notification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px 24px;line-height:1.55;color:#222;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px;border-top:1px solid #eee;font-size:11px;color:${MUTED};">
              This message was sent by the inventory system. Please acknowledge in the app under <strong>Acknowledgements</strong> when your records are updated.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInRepairEmail(params: {
  greeting: string;
  assetName: string;
  serial: string | null;
  category: string;
  repairReference: string;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `Repair logged · ${params.repairReference} · ${params.assetName}`;
  const body = `
    <p style="margin:0 0 12px 0;">${esc(params.greeting)}</p>
    <p style="margin:0 0 12px 0;">A device has been moved to <strong>In repairs</strong> and a repair voucher was created.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:${MUTED};width:140px;">Repair reference</td><td style="padding:6px 0;"><strong>${esc(params.repairReference)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Asset</td><td style="padding:6px 0;">${esc(params.assetName)}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Category</td><td style="padding:6px 0;">${esc(params.category)}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Serial</td><td style="padding:6px 0;">${params.serial ? esc(params.serial) : "—"}</td></tr>
    </table>
    <p style="margin:16px 0 0 0;">
      <a href="${esc(params.appUrl + "/acknowledgements")}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:bold;font-size:13px;">Open acknowledgements</a>
    </p>
  `;
  return { subject, html: wrapHnaEmailHtml(body) };
}

export function buildWrittenOffEmail(params: {
  greeting: string;
  assetName: string;
  serial: string | null;
  category: string;
  reason: string | null;
  appUrl: string;
}): { subject: string; html: string } {
  const subject = `Written off · ${params.assetName}`;
  const body = `
    <p style="margin:0 0 12px 0;">${esc(params.greeting)}</p>
    <p style="margin:0 0 12px 0;">An asset has been marked <strong>Written off</strong>. Please update your financial records and acknowledge in the system.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:${MUTED};width:140px;">Asset</td><td style="padding:6px 0;">${esc(params.assetName)}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Category</td><td style="padding:6px 0;">${esc(params.category)}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};">Serial</td><td style="padding:6px 0;">${params.serial ? esc(params.serial) : "—"}</td></tr>
      <tr><td style="padding:6px 0;color:${MUTED};vertical-align:top;">Reason / notes</td><td style="padding:6px 0;">${params.reason ? esc(params.reason) : "—"}</td></tr>
    </table>
    <p style="margin:16px 0 0 0;">
      <a href="${esc(params.appUrl + "/acknowledgements")}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:bold;font-size:13px;">Open acknowledgements</a>
    </p>
  `;
  return { subject, html: wrapHnaEmailHtml(body) };
}

export function greetingLine(financeGreetingName: string | null): string {
  const n = financeGreetingName?.trim();
  if (n) return `Hi ${n},`;
  return "Hi,";
}
