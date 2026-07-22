import { randomBytes } from "crypto";

/** Stable human-readable write-off certificate id (PDF filename, finance ack). */
export function newWriteOffCertificateReference(): string {
  const y = new Date().getFullYear();
  return `HNA-WOF-${y}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
