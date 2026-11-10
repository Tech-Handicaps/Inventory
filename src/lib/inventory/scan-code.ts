/** What a scanned barcode / QR code points at, before looking it up. */
export type ParsedScanCode =
  | { kind: "asset_id"; assetId: string; raw: string }
  | { kind: "serial"; serial: string; raw: string };

const SERIAL_PREFIX = /^(?:s\/?n|serial(?:\s*(?:no\.?|number))?|service\s*tag|ser(?:\.|ial)?\s*#?)\s*[:#.\-]?\s*/i;

/** Host suffixes whose QR codes end in the device's service tag / serial. */
const VENDOR_SERIAL_HOSTS = ["dell.com", "lenovo.com", "hp.com"];

function tryUrl(text: string): URL | null {
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/**
 * Turn a scanned code into something to look up:
 * - this app's links (`…/assets?asset=<id>`) → the asset id;
 * - vendor support QR codes (e.g. qrl.dell.com/<tag>) → the last path segment as serial;
 * - "S/N: ABC 123" style labels → "ABC123".
 * Returns null for empty input.
 */
export function parseScanCode(input: string): ParsedScanCode | null {
  const raw = input.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!raw) return null;

  const url = tryUrl(raw);
  if (url) {
    const assetId = url.searchParams.get("asset")?.trim();
    if (assetId) return { kind: "asset_id", assetId, raw };
    const host = url.hostname.toLowerCase();
    if (VENDOR_SERIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      const last = url.pathname.split("/").filter(Boolean).pop();
      if (last) return { kind: "serial", serial: normaliseSerial(decodeURIComponent(last)), raw };
    }
    return { kind: "serial", serial: raw, raw };
  }

  const serial = normaliseSerial(raw);
  return serial ? { kind: "serial", serial, raw } : null;
}

/** Strip label prefixes and whitespace; case is kept (lookups are case-insensitive). */
export function normaliseSerial(text: string): string {
  return text.trim().replace(SERIAL_PREFIX, "").replace(/\s+/g, "");
}
