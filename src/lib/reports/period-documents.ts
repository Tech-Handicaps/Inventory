import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const PERIOD_DOCUMENT_BUCKET = "period-documents";
export {
  ALLOWED_PERIOD_MIME,
  defaultFlagFor,
  isAllowedMime,
  isPeriodDocumentKind,
  MAX_PERIOD_DOCUMENT_BYTES,
  PERIOD_DOCUMENT_KINDS,
  type PeriodDocumentKind,
} from "@/lib/reports/period-document-kinds";
import { ALLOWED_PERIOD_MIME, MAX_PERIOD_DOCUMENT_BYTES } from "@/lib/reports/period-document-kinds";

export function safeFileName(name: string): string {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 120) || "document";
}

export function newStoragePath(monthKey: string, fileName: string): string {
  return `${monthKey}/${randomUUID()}-${safeFileName(fileName).replace(/ /g, "_")}`;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function ensurePeriodDocumentBucket(): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(PERIOD_DOCUMENT_BUCKET, {
    public: false,
    allowedMimeTypes: ALLOWED_PERIOD_MIME,
    fileSizeLimit: MAX_PERIOD_DOCUMENT_BYTES,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Could not prepare document storage: ${error.message}`);
  }
}
