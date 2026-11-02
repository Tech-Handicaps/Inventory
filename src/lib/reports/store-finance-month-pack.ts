import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  FINANCE_PACK_BUCKET,
  financePackCsv,
  financePackSnapshot,
  financePackStoragePath,
  type FinancePackSnapshot,
} from "@/lib/reports/finance-month-pack";
import type {
  StockBreakdownReport,
  StockReconcileReport,
} from "@/lib/reports/stock-reconcile";

export type StoreFinancePackInput = {
  monthKey: string;
  monthLabel: string;
  monthEndingLabel: string;
  /** "system" for the scheduled run, otherwise the user id. */
  generatedBy: string;
  reconcilePdf: Buffer;
  breakdownPdf: Buffer;
  monthOnMonthPdf: Buffer;
  yearlyPdf: Buffer;
  fieldListingPdf: Buffer;
  reconcile: StockReconcileReport;
  breakdown: StockBreakdownReport;
  fieldUnits: FinancePackSnapshot["fieldUnits"];
};

export type StoredPackFile = {
  kind: "reconcile" | "breakdown" | "month-on-month" | "yearly" | "field" | "csv";
  path: string;
  body: Buffer;
  contentType: string;
};

export type StoreFinancePackResult = {
  stored: boolean;
  alreadyKept: boolean;
  files: StoredPackFile[];
};

function isAlreadyThere(error: { message: string; error?: string }): boolean {
  const name = error.error ?? error.message;
  return name === "Duplicate" || /already exists|duplicate/i.test(error.message);
}

const PACK_MIME = ["application/pdf", "text/csv"];

async function ensurePrivateBucket(): Promise<void> {
  const supabase = createSupabaseAdmin();
  const options = { public: false, allowedMimeTypes: PACK_MIME, fileSizeLimit: 20 * 1024 * 1024 };
  const { error } = await supabase.storage.createBucket(FINANCE_PACK_BUCKET, options);
  if (!error) return;
  if (!isAlreadyThere(error)) {
    throw new Error(`Could not prepare finance pack storage: ${error.message}`);
  }
  const updated = await supabase.storage.updateBucket(FINANCE_PACK_BUCKET, options);
  if (updated.error) {
    throw new Error(`Could not prepare finance pack storage: ${updated.error.message}`);
  }
}

async function upload(file: StoredPackFile): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .storage.from(FINANCE_PACK_BUCKET)
    .upload(file.path, file.body, { contentType: file.contentType, upsert: false });
  if (error && !isAlreadyThere(error)) {
    throw new Error(`Could not store ${file.path}: ${error.message}`);
  }
}

export function sha256(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * Store the official pack for a report month (PDFs + CSV, each hashed).
 * A month that is already stored is left unchanged.
 */
export async function storeOfficialFinancePack(
  input: StoreFinancePackInput
): Promise<StoreFinancePackResult> {
  const existing = await prisma.financeMonthPack.findUnique({
    where: { monthKey: input.monthKey },
    select: { id: true },
  });
  if (existing) return { stored: false, alreadyKept: true, files: [] };

  const snapshot = financePackSnapshot(input.reconcile, input.breakdown);
  const csv = Buffer.from(
    financePackCsv(input.monthEndingLabel, { ...snapshot, fieldUnits: input.fieldUnits }),
    "utf8"
  );
  const pdf = "application/pdf";
  const files: StoredPackFile[] = [
    { kind: "reconcile", path: financePackStoragePath(input.monthKey, "reconcile"), body: input.reconcilePdf, contentType: pdf },
    { kind: "breakdown", path: financePackStoragePath(input.monthKey, "breakdown"), body: input.breakdownPdf, contentType: pdf },
    { kind: "month-on-month", path: financePackStoragePath(input.monthKey, "month-on-month"), body: input.monthOnMonthPdf, contentType: pdf },
    { kind: "yearly", path: financePackStoragePath(input.monthKey, "yearly"), body: input.yearlyPdf, contentType: pdf },
    { kind: "field", path: financePackStoragePath(input.monthKey, "field"), body: input.fieldListingPdf, contentType: pdf },
    { kind: "csv", path: financePackStoragePath(input.monthKey, "csv"), body: csv, contentType: "text/csv" },
  ];
  const byKind = Object.fromEntries(files.map((file) => [file.kind, file.path]));

  await ensurePrivateBucket();
  for (const file of files) await upload(file);

  try {
    await prisma.financeMonthPack.create({
      data: {
        monthKey: input.monthKey,
        monthLabel: input.monthLabel,
        monthEndingLabel: input.monthEndingLabel,
        recipientCount: 0,
        ...snapshot.totals,
        reconcileStoragePath: byKind.reconcile,
        breakdownStoragePath: byKind.breakdown,
        monthOnMonthStoragePath: byKind["month-on-month"],
        yearlyStoragePath: byKind.yearly,
        fieldListingStoragePath: byKind.field,
        csvStoragePath: byKind.csv,
        fileHashes: Object.fromEntries(files.map((file) => [file.path, sha256(file.body)])),
        generatedBy: input.generatedBy,
        lines: { create: snapshot.lines },
        types: { create: snapshot.typeTotals },
        fieldUnits: { create: input.fieldUnits },
      },
    });
    return { stored: true, alreadyKept: false, files };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { stored: false, alreadyKept: true, files: [] };
    }
    throw error;
  }
}

/** Read a stored pack's files back for a resend or a retry. */
export async function loadStoredPackFiles(pack: {
  reconcileStoragePath: string;
  breakdownStoragePath: string;
  monthOnMonthStoragePath: string;
  yearlyStoragePath: string;
  fieldListingStoragePath: string;
  csvStoragePath: string | null;
}): Promise<StoredPackFile[]> {
  const wanted: Omit<StoredPackFile, "body">[] = [
    { kind: "reconcile", path: pack.reconcileStoragePath, contentType: "application/pdf" },
    { kind: "breakdown", path: pack.breakdownStoragePath, contentType: "application/pdf" },
    { kind: "month-on-month", path: pack.monthOnMonthStoragePath, contentType: "application/pdf" },
    { kind: "yearly", path: pack.yearlyStoragePath, contentType: "application/pdf" },
    { kind: "field", path: pack.fieldListingStoragePath, contentType: "application/pdf" },
    ...(pack.csvStoragePath ? [{ kind: "csv" as const, path: pack.csvStoragePath, contentType: "text/csv" }] : []),
  ];
  const storage = createSupabaseAdmin().storage.from(FINANCE_PACK_BUCKET);
  return Promise.all(
    wanted.map(async (file) => {
      const { data, error } = await storage.download(file.path);
      if (error || !data) throw new Error(`Stored file missing: ${file.path}`);
      return { ...file, body: Buffer.from(await data.arrayBuffer()) };
    })
  );
}
