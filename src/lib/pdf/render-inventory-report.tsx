import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  InventoryReportDocument,
  type PdfAssetRow,
} from "@/lib/pdf/inventory-report-document";

export type InventoryReportPdfInput = {
  title: string;
  subtitle: string;
  generatedAt: string;
  logoSource: Buffer | string | null;
  summaryRows: { label: string; value: string }[];
  rows: PdfAssetRow[];
};

/** Renders PDF outside route try/catch (ESLint: no JSX in try/catch). */
export async function renderInventoryReportPdf(input: InventoryReportPdfInput) {
  return renderToBuffer(
    createElement(InventoryReportDocument, {
      title: input.title,
      subtitle: input.subtitle,
      generatedAt: input.generatedAt,
      logoSource: input.logoSource,
      summaryRows: input.summaryRows,
      rows: input.rows,
    })
  );
}
