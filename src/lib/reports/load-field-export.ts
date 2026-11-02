import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { parseFieldExport, type ParsedFieldExport } from "@/lib/reports/field-export";
import { PERIOD_DOCUMENT_BUCKET } from "@/lib/reports/period-documents";
import { readXlsx } from "@/lib/xlsx/read-xlsx";

export type StoredFieldExport = ParsedFieldExport & {
  documentId: string;
  fileName: string;
  /** `YYYY-MM-DD`: the date on the document, else the date in the export sheet name, else the upload date. */
  exportDate: string;
};

/** Stored documents are immutable, so a parse is cached for as long as its document id is the latest. */
const parseStored = unstable_cache(
  async (_documentId: string, storagePath: string): Promise<ParsedFieldExport> => {
    const { data, error } = await createSupabaseAdmin().storage.from(PERIOD_DOCUMENT_BUCKET).download(storagePath);
    if (error || !data) throw new Error(`Could not read the stored field export: ${error?.message ?? "no data"}`);
    return parseFieldExport(readXlsx(new Uint8Array(await data.arrayBuffer())));
  },
  ["field-export-parse-v1"],
  { revalidate: 86400 }
);

/** The newest stored field terminal export (period document kind `field_export`), or null. */
export async function loadLatestFieldExport(): Promise<StoredFieldExport | null> {
  const doc = await prisma.periodDocument.findFirst({
    where: { kind: "field_export", mimeType: { contains: "spreadsheetml" } },
    orderBy: [{ documentDate: { sort: "desc", nulls: "last" } }, { uploadedAt: "desc" }],
    select: { id: true, fileName: true, storagePath: true, documentDate: true, uploadedAt: true },
  });
  if (!doc) return null;
  try {
    const parsed = await parseStored(doc.id, doc.storagePath);
    return {
      ...parsed,
      documentId: doc.id,
      fileName: doc.fileName,
      exportDate: (doc.documentDate ?? null)?.toISOString().slice(0, 10) ?? parsed.exportDate ?? doc.uploadedAt.toISOString().slice(0, 10),
    };
  } catch (error) {
    console.error("loadLatestFieldExport", error);
    return null;
  }
}
