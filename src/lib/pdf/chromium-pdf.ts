import { existsSync } from "fs";
import type { Browser } from "puppeteer-core";

let browserPromise: Promise<Browser> | null = null;

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTION_NAME
  );
}

function findLocalChromeExecutable(): string | undefined {
  const fromEnv =
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_PATH?.trim() ||
    process.env.CHROMIUM_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((p) => existsSync(p));
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");

  if (isServerless()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const executablePath = findLocalChromeExecutable();
  if (!executablePath) {
    throw new Error(
      "No Chrome/Edge found for PDF print. Install Google Chrome, or set PUPPETEER_EXECUTABLE_PATH to a Chromium binary."
    );
  }

  return puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export type ChromiumPdfOptions = {
  format?: "A4" | "Letter";
  landscape?: boolean;
  printBackground?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
};

/**
 * Render HTML to PDF via Chromium print (page.pdf).
 * Prefer this for all inventory download/print PDFs.
 */
export async function htmlToPdfBuffer(
  html: string,
  options: ChromiumPdfOptions = {}
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, {
      waitUntil: "load",
      timeout: 60_000,
    });
    const pdf = await page.pdf({
      format: options.format ?? "A4",
      landscape: options.landscape ?? false,
      printBackground: options.printBackground ?? true,
      // Page margins come from CSS @page / body padding — avoid double margins that clip the logo.
      margin: options.margin ?? {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escOptional(s: string | null | undefined): string {
  const t = typeof s === "string" ? s.trim() : "";
  return t ? escHtml(t) : "—";
}

/** Shared print stylesheet for Chromium PDF documents. */
export function pdfDocumentChrome(params: {
  title: string;
  bodyHtml: string;
  logoDataUrl?: string | null;
  watermarkText?: string | null;
}): string {
  const watermark = params.watermarkText?.trim()
    ? `<div class="watermark" aria-hidden="true">${escHtml(params.watermarkText.trim())}</div>`
    : "";
  const logo = params.logoDataUrl
    ? `<img class="logo" src="${params.logoDataUrl}" alt="Handicaps Network Africa" />`
    : `<div class="logo-fallback">Handicaps Network Africa</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(params.title)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14mm 16mm 16mm 16mm;
      font-family: "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #111;
      position: relative;
    }
    .watermark {
      position: fixed;
      top: 42%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      font-size: 42px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(19, 157, 75, 0.14);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
    }
    .sheet { position: relative; z-index: 1; overflow: visible; }
    .bar {
      height: 5px;
      background: #139d4b;
      margin: -14mm -16mm 18px -16mm;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      overflow: visible;
    }
    .logo {
      display: block;
      height: 52px;
      max-width: 240px;
      width: auto;
      object-fit: contain;
      object-position: left center;
    }
    .logo-fallback {
      font-weight: 800;
      font-size: 14px;
      text-transform: uppercase;
      color: #139d4b;
      letter-spacing: 0.04em;
    }
    h1 {
      margin: 0 0 4px 0;
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .ref {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 700;
      color: #139d4b;
    }
    .subtitle { margin: 0 0 16px 0; color: #555; font-size: 10px; }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px solid #ddd;
    }
    .meta-label { font-size: 8px; color: #555; margin-bottom: 3px; text-transform: uppercase; }
    .meta-value { font-size: 11px; font-weight: 700; }
    h2 {
      margin: 0 0 10px 0;
      font-size: 11px;
      color: #139d4b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    table.details {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #ddd;
      margin-bottom: 18px;
    }
    table.details th, table.details td {
      border-bottom: 1px solid #eee;
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }
    table.details th {
      width: 32%;
      background: #f9faf9;
      color: #555;
      font-size: 9px;
      font-weight: 700;
    }
    table.details td { font-size: 10px; }
    table.list {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.list th {
      border-bottom: 1px solid #139d4b;
      padding: 6px 4px;
      text-align: left;
      font-size: 7px;
      text-transform: uppercase;
    }
    table.list td {
      border-bottom: 0.5px solid #eee;
      padding: 5px 4px;
      font-size: 7px;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .summary-cell {
      width: 31%;
      border: 1px solid #ddd;
      padding: 8px;
      background: #f9faf9;
    }
    .summary-label { font-size: 8px; color: #555; margin-bottom: 4px; }
    .summary-value { font-size: 12px; font-weight: 700; }
    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 0.5px solid #ccc;
      font-size: 8px;
      color: #555;
    }
  </style>
</head>
<body>
  ${watermark}
  <div class="sheet">
    <div class="bar"></div>
    <div class="brand">${logo}</div>
    ${params.bodyHtml}
  </div>
</body>
</html>`;
}

export function logoBufferToDataUrl(buf: Buffer | null): string | null {
  if (!buf || buf.length === 0) return null;
  return `data:image/png;base64,${buf.toString("base64")}`;
}
