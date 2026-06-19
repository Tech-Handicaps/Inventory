import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import {
  DispatchVoucherDocument,
  type DispatchVoucherPdfFields,
} from "@/lib/pdf/dispatch-voucher-document";

export async function renderDispatchVoucherPdf(
  fields: DispatchVoucherPdfFields,
  logoSource: Buffer | string | null
): Promise<Buffer> {
  return renderToBuffer(
    createElement(DispatchVoucherDocument, {
      ...fields,
      logoSource,
    }) as ReactElement<DocumentProps>
  );
}
