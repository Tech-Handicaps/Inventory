import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  FINANCE_PACK_BUCKET,
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
  recipientCount: number;
  reconcilePdf: Buffer;
  breakdownPdf: Buffer;
  monthOnMonthPdf: Buffer;
  yearlyPdf: Buffer;
  fieldListingPdf: Buffer;
  reconcile: StockReconcileReport;
  breakdown: StockBreakdownReport;
  fieldUnits: FinancePackSnapshot["fieldUnits"];
};

export type StoreFinancePackResult = {
  stored: boolean;
  alreadyKept: boolean;
};

function storageErrorName(error: { message: string; error?: string }): string {
  return error.error ?? error.message;
}

function isAlreadyThere(error: { message: string; error?: string }): boolean {
  const name = storageErrorName(error);
  return name === "Duplicate" || /already exists|duplicate/i.test(error.message);
}

async function ensurePrivateBucket(): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage.createBucket(FINANCE_PACK_BUCKET, {
    public: false,
    allowedMimeTypes: ["application/pdf"],
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error && !isAlreadyThere(error)) {
    throw new Error(`Could not prepare finance pack storage: ${error.message}`);
  }
}

async function uploadPdf(path: string, body: Buffer): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage.from(FINANCE_PACK_BUCKET).upload(path, body, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error && !isAlreadyThere(error)) {
    throw new Error(`Could not store ${path}: ${error.message}`);
  }
}

async function insertPack(
  input: StoreFinancePackInput,
  snapshot: FinancePackSnapshot,
  reconcilePath: string,
  breakdownPath: string,
  monthOnMonthPath: string,
  yearlyPath: string,
  fieldListingPath: string
): Promise<StoreFinancePackResult> {
  try {
    await prisma.financeMonthPack.create({
      data: {
        monthKey: input.monthKey,
        monthLabel: input.monthLabel,
        monthEndingLabel: input.monthEndingLabel,
        recipientCount: input.recipientCount,
        ...snapshot.totals,
        reconcileStoragePath: reconcilePath,
        breakdownStoragePath: breakdownPath,
        monthOnMonthStoragePath: monthOnMonthPath,
        yearlyStoragePath: yearlyPath,
        fieldListingStoragePath: fieldListingPath,
        lines: { create: snapshot.lines },
        types: { create: snapshot.typeTotals },
        fieldUnits: { create: input.fieldUnits },
      },
    });
    return { stored: true, alreadyKept: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { stored: false, alreadyKept: true };
    }
    throw error;
  }
}

/**
 * Store the official pack for a report month. An existing month is left unchanged.
 */
export async function storeOfficialFinancePack(
  input: StoreFinancePackInput
): Promise<StoreFinancePackResult> {
  const existing = await prisma.financeMonthPack.findUnique({
    where: { monthKey: input.monthKey },
    select: { id: true },
  });
  if (existing) return { stored: false, alreadyKept: true };

  const snapshot = financePackSnapshot(input.reconcile, input.breakdown);
  const reconcilePath = financePackStoragePath(input.monthKey, "reconcile");
  const breakdownPath = financePackStoragePath(input.monthKey, "breakdown");
  const monthOnMonthPath = financePackStoragePath(input.monthKey, "month-on-month");
  const yearlyPath = financePackStoragePath(input.monthKey, "yearly");
  const fieldListingPath = financePackStoragePath(input.monthKey, "field");

  await ensurePrivateBucket();
  await uploadPdf(reconcilePath, input.reconcilePdf);
  await uploadPdf(breakdownPath, input.breakdownPdf);
  await uploadPdf(monthOnMonthPath, input.monthOnMonthPdf);
  await uploadPdf(yearlyPath, input.yearlyPdf);
  await uploadPdf(fieldListingPath, input.fieldListingPdf);
  return insertPack(
    input,
    snapshot,
    reconcilePath,
    breakdownPath,
    monthOnMonthPath,
    yearlyPath,
    fieldListingPath
  );
}
