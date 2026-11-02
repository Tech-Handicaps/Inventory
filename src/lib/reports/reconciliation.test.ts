import { describe, expect, it } from "vitest";
import { RECONCILIATION_SEED } from "@/lib/reports/prior-company-seed";
import {
  buildReconciliation,
  fieldCapture,
  registerComposition,
  type RegisterAsset,
} from "@/lib/reports/reconciliation";

function assets(count: number, statusCode: string, category = "Hardware", hasCertificate = false): RegisterAsset[] {
  return Array.from({ length: count }, () => ({ category, tags: [], statusCode, hasCertificate }));
}

const register = registerComposition([
  ...assets(10, "new_stock"),
  ...assets(1, "refurbished"),
  ...assets(115, "deployed"),
  ...assets(3, "written_off", "Hardware", true),
  ...assets(7, "new_stock", "USB HID Magnetic Stripe Reader"),
]);

describe("reconciliation", () => {
  it("splits the register into 129 hardware and 7 USB readers", () => {
    expect(register.total).toBe(136);
    expect(register.hardware).toMatchObject({ total: 129, newStock: 10, refurbished: 1, deployed: 115, writtenOff: 3 });
    expect(register.usbReaders).toBe(7);
    expect(register.writtenOffWithCertificate).toBe(3);
    expect(register.pendingDisposal).toBe(0);
  });

  it("bridges 132 to 136 and leaves the difference visible instead of balancing it", () => {
    const report = buildReconciliation(
      RECONCILIATION_SEED.map((line, index) => ({
        ...line,
        id: String(index),
        sortOrder: index,
        evidenceDocumentId: null,
        updatedAt: "",
      })),
      register
    );
    expect(report.lines[0].runningTotal).toBe(132);
    expect(report.lines[2].runningTotal).toBe(43);
    expect(report.bridgedTotal).toBe(158);
    expect(report.unexplained).toBe(-22);
    expect(report.toBeConfirmed).toBe(1);
  });

  it("counts a write-off without a certificate as pending disposal", () => {
    expect(registerComposition(assets(1, "written_off")).pendingDisposal).toBe(1);
  });

  it("estimates field capture from Deployed when the export cannot be read", () => {
    expect(fieldCapture(115)).toMatchObject({ captured: 115, notYetCaptured: 190, capturedPct: 37.7, matched: false });
  });

  it("uses the matched count when the export breakdown is available", () => {
    const breakdown = { matched: 108 } as Parameters<typeof fieldCapture>[2];
    expect(fieldCapture(115, undefined, breakdown)).toMatchObject({
      captured: 108,
      notYetCaptured: 197,
      capturedPct: 35.4,
      deployed: 115,
      matched: true,
    });
  });
});
