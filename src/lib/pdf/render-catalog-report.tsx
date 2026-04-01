import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  CatalogReportDocument,
  type PdfCatalogRow,
} from "@/lib/pdf/catalog-report-document";

export type CatalogReportPdfInput = {
  title: string;
  subtitle: string;
  generatedAt: string;
  logoDataUri: string | null;
  summaryRows: { label: string; value: string }[];
  rows: PdfCatalogRow[];
};

export async function renderCatalogReportPdf(input: CatalogReportPdfInput) {
  return renderToBuffer(
    createElement(CatalogReportDocument, {
      title: input.title,
      subtitle: input.subtitle,
      generatedAt: input.generatedAt,
      logoDataUri: input.logoDataUri,
      summaryRows: input.summaryRows,
      rows: input.rows,
    })
  );
}
