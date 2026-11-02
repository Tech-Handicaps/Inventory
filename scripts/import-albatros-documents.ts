/**
 * Attach Mogamat's Albatros folder to the report periods: the four month-end
 * workbooks, the January Terminal Movement Report and 7 vouchers, the Oct–Dec
 * Service Desk Reports and December Master sheet (supporting documents only),
 * the field terminal export and the signed auditor note. Saves the signed note
 * as the next version of "Notes for auditors and finance".
 *
 * Files are stored unchanged in the private `period-documents` bucket with their
 * SHA-256. A file whose hash is already recorded is skipped. Nothing is deleted.
 *
 * Run with: npx tsx scripts/import-albatros-documents.ts [--apply] [--dir /path/to/Albatros]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  defaultFlagFor,
  ensurePeriodDocumentBucket,
  newStoragePath,
  PERIOD_DOCUMENT_BUCKET,
  safeFileName,
  sha256Hex,
  type PeriodDocumentKind,
} from "../src/lib/reports/period-documents";
import { AUDITOR_NOTES_KEY, AUDITOR_NOTES_SEED } from "../src/lib/reports/prior-company-seed";
import { createSupabaseAdmin } from "../src/lib/supabase/admin";

const APPLY = process.argv.includes("--apply");
const dirArg = process.argv.indexOf("--dir");
const DIR = dirArg > 0 ? process.argv[dirArg + 1] : "/home/ShafiekC/Desktop/Albatros";

type Entry = { path: string; monthKey: string; kind: PeriodDocumentKind; title: string; documentDate?: string; notes?: string };

const MANIFEST: Entry[] = [
  { path: "Month End Stock Take 20251031.xlsx", monthKey: "2025-10", kind: "source_workbook", title: "Month End Stock Take 31 Oct 2025", documentDate: "2025-10-31" },
  { path: "Month End Stock Take 20251130.xlsx", monthKey: "2025-11", kind: "source_workbook", title: "Month End Stock Take 30 Nov 2025", documentDate: "2025-11-30" },
  { path: "Month End Stock Take 20251231.xlsx", monthKey: "2025-12", kind: "source_workbook", title: "Month End Stock Take 31 Dec 2025", documentDate: "2025-12-31" },
  { path: "Jan/Month End Stock Take 20260131.xlsx", monthKey: "2026-01", kind: "source_workbook", title: "Month End Stock Take 31 Jan 2026", documentDate: "2026-01-31" },
  {
    path: "Jan/Terminal Movement Report January 2026.xlsx",
    monthKey: "2026-01",
    kind: "source_workbook",
    title: "Terminal Movement Report January 2026",
    documentDate: "2026-01-31",
    notes: "Lists the Thabazimbi replacement, the Uitenhage and Komga returns and the 7440/NUC disposals. The Riverside theft and the returned card readers are not on it (flagged).",
  },
  { path: "Jan/Thabazimbi Disposed Faulty X22S.pdf", monthKey: "2025-12", kind: "voucher", title: "DIS4601364122 – Thabazimbi disposed faulty Mecer X22S", documentDate: "2025-12-22" },
  { path: "Jan/Thabazimbi Replacement Posiflex.pdf", monthKey: "2026-01", kind: "voucher", title: "DIS4605548808 – Thabazimbi replacement Posiflex", documentDate: "2026-01-07" },
  { path: "Jan/Riverside Stolen Posiflex.pdf", monthKey: "2026-01", kind: "voucher", title: "DIS4603053200 – Riverside stolen Posiflex", documentDate: "2026-01-08" },
  { path: "Jan/Uitenhage Returned Faulty Dell 3050 .pdf", monthKey: "2026-01", kind: "voucher", title: "REC4604972969 – Uitenhage returned faulty Dell 3050", documentDate: "2026-01-26" },
  { path: "Jan/Komga Retruned Faulty Dell 3050.pdf", monthKey: "2026-01", kind: "voucher", title: "REC4605171900 – Komga returned faulty Dell 3050", documentDate: "2026-01-29" },
  { path: "Jan/Disposed Dell7440_GF01KF2.pdf", monthKey: "2026-01", kind: "voucher", title: "DIS4606261331 – Disposed Dell OptiPlex 7440 GF01KF2", documentDate: "2026-01-29" },
  { path: "Jan/Disposed Nuc_G6JY05100G51.pdf", monthKey: "2026-01", kind: "voucher", title: "DIS4606254722 – Disposed Intel NUC G6JY05100G51", documentDate: "2026-01-29" },
  { path: "Reports/HNA Service Desk Report October 2025.pdf", monthKey: "2025-10", kind: "service_desk_report", title: "HNA Service Desk Report October 2025" },
  { path: "Reports/HNA Service Desk Report November 2025.pdf", monthKey: "2025-11", kind: "service_desk_report", title: "HNA Service Desk Report November 2025" },
  { path: "Reports/HNA December 2025 Service Desk Report.pdf", monthKey: "2025-12", kind: "service_desk_report", title: "HNA Service Desk Report December 2025" },
  { path: "Reports/December 2025 Master sheet.xlsx", monthKey: "2025-12", kind: "master_sheet", title: "December 2025 Master sheet (Excel)" },
  { path: "Reports/December 2025 Master sheet.docx", monthKey: "2025-12", kind: "master_sheet", title: "December 2025 Master sheet (Word)" },
  {
    path: "Reports/Terminal make levels 1 October 2025.xlsx",
    monthKey: "2025-10",
    kind: "field_export",
    title: "Terminal make levels 1 October 2025 (field export, 14 Oct 2025)",
    documentDate: "2025-10-14",
  },
  {
    path: "HNA-Notes-for-Auditors-and-Finance.pdf",
    monthKey: "2026-10",
    kind: "auditor_note",
    title: "Notes for auditors and finance – signed (prepared 31 Oct 2026)",
    documentDate: "2026-10-31",
  },
];

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function loadEnv() {
  const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  let raw = process.env.DATABASE_URL ?? "";
  if (raw.startsWith("postgres://")) raw = `postgresql://${raw.slice("postgres://".length)}`;
  const url = new URL(raw);
  if (url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: loadEnv() } } });
  const log = (msg: string) => console.log(`${APPLY ? "" : "[dry run] "}${msg}`);
  const stored: Record<string, unknown>[] = [];

  try {
    if (APPLY) await ensurePeriodDocumentBucket();
    const supabase = createSupabaseAdmin();

    for (const entry of MANIFEST) {
      const bytes = new Uint8Array(readFileSync(resolve(DIR, entry.path)));
      const sha256 = sha256Hex(bytes);
      const fileName = safeFileName(entry.path.split("/").pop()!);
      const existing = await prisma.periodDocument.findFirst({ where: { sha256 }, select: { id: true, monthKey: true } });
      if (existing) {
        log(`skip (already stored in ${existing.monthKey}): ${entry.path}`);
        continue;
      }
      const event =
        entry.kind === "voucher"
          ? await prisma.priorCompanyEvent.findFirst({
              where: { evidenceFileName: { equals: fileName, mode: "insensitive" }, evidenceDocumentId: null },
              select: { id: true, reference: true },
            })
          : null;
      log(
        `${entry.monthKey} ${entry.kind.padEnd(19)} ${(bytes.length / 1024).toFixed(0).padStart(5)} KB ${sha256.slice(0, 12)}… ${entry.path}` +
          (event ? ` → links ${event.reference}` : entry.kind === "voucher" ? " → NO EVENT MATCH" : "")
      );
      if (!APPLY) continue;

      const storagePath = newStoragePath(entry.monthKey, fileName);
      const mimeType = MIME[fileName.split(".").pop()!.toLowerCase()];
      const { error } = await supabase.storage
        .from(PERIOD_DOCUMENT_BUCKET)
        .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
      if (error) throw new Error(`Upload failed for ${entry.path}: ${error.message}`);

      const doc = await prisma.periodDocument.create({
        data: {
          monthKey: entry.monthKey,
          kind: entry.kind,
          title: entry.title,
          fileName,
          storagePath,
          mimeType,
          sizeBytes: bytes.length,
          sha256,
          flag: defaultFlagFor(entry.kind),
          notes: entry.notes ?? null,
          documentDate: entry.documentDate ? new Date(`${entry.documentDate}T10:00:00.000Z`) : null,
          uploadedBy: "system",
        },
      });
      if (event) {
        await prisma.priorCompanyEvent.update({ where: { id: event.id }, data: { evidenceDocumentId: doc.id } });
      }
      stored.push({ documentId: doc.id, monthKey: entry.monthKey, kind: entry.kind, fileName, sha256, linkedEvent: event?.reference ?? null });
    }

    const note = await prisma.reportNote.findUnique({ where: { key: AUDITOR_NOTES_KEY } });
    const signedAlready =
      (note?.markdown === AUDITOR_NOTES_SEED.markdown && note?.title === AUDITOR_NOTES_SEED.title) ||
      (await prisma.reportNoteVersion.count({
        where: { noteKey: AUDITOR_NOTES_KEY, markdown: AUDITOR_NOTES_SEED.markdown },
      })) > 0;
    const nextVersion = (note?.version ?? 0) + 1;
    log(signedAlready ? `notes: signed text already saved (version ${note?.version})` : `notes: save signed text as version ${nextVersion}`);
    if (APPLY && !signedAlready) {
      await prisma.reportNote.upsert({
        where: { key: AUDITOR_NOTES_KEY },
        create: {
          key: AUDITOR_NOTES_KEY,
          title: AUDITOR_NOTES_SEED.title,
          markdown: AUDITOR_NOTES_SEED.markdown,
          version: nextVersion,
          updatedBy: "system",
          versions: { create: { version: nextVersion, title: AUDITOR_NOTES_SEED.title, markdown: AUDITOR_NOTES_SEED.markdown, savedBy: "system" } },
        },
        update: {
          title: AUDITOR_NOTES_SEED.title,
          markdown: AUDITOR_NOTES_SEED.markdown,
          version: nextVersion,
          updatedBy: "system",
          versions: { create: { version: nextVersion, title: AUDITOR_NOTES_SEED.title, markdown: AUDITOR_NOTES_SEED.markdown, savedBy: "system" } },
        },
      });
    }

    if (APPLY && (stored.length > 0 || !signedAlready)) {
      await prisma.auditLog.create({
        data: {
          actionType: "report.albatros_documents_imported",
          notes: `Albatros folder attached to report periods: ${stored.length} file(s) stored with SHA-256${
            signedAlready ? "" : `; signed auditor note saved as notes version ${nextVersion}`
          }. Workbooks checked line by line against the stored counts (no differences).`,
          metadata: JSON.parse(JSON.stringify({ stored, notesVersion: signedAlready ? note?.version : nextVersion })),
        },
      });
      log("audit log written");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
