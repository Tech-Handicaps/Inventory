import { randomBytes } from "crypto";

/** Stable human-readable dispatch voucher id (PDF filename, email subject, finance ack). */
export function newDispatchVoucherReference(): string {
  const y = new Date().getFullYear();
  return `HNA-DSP-${y}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function dispatchFromStatusLabel(code: string): string {
  if (code === "assessment") return "Assessment / Maintenance";
  if (code === "repair") return "In Repairs";
  if (code === "written_off") return "Written off";
  return code;
}

/** True when a lifecycle move should issue a dispatch voucher (Assessment or Repairs → Deployed). */
export function shouldIssueDispatchVoucher(
  fromStatusCode: string,
  toStatusCode: string
): boolean {
  return (
    toStatusCode === "deployed" &&
    (fromStatusCode === "assessment" || fromStatusCode === "repair")
  );
}
