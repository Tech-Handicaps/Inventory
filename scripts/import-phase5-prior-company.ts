/**
 * Phase 5 prior-company data: the Oct 2025–Jun 2026 periods (real 31 Jan 2026 count,
 * Feb–Jun carried forward from it), the 7 January movement events, flagged
 * inconsistencies, model aliases, the starting reconciliation lines, the May 2026
 * hand-over record and the first version of the auditor notes.
 *
 * Dry run by default; pass --apply to write. Never deletes a period, event or
 * register asset. Seed rows an administrator has since edited are left alone.
 *
 * Run with: npx tsx scripts/import-phase5-prior-company.ts [--apply] [--skip-periods]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildLegacyMonthEndDrafts, summarizeLegacyLines } from "../src/lib/reports/legacy-month-end";
import {
  AUDITOR_NOTES_KEY,
  AUDITOR_NOTES_SEED,
  HANDOVER_SEED,
  JANUARY_2026_EVENTS,
  MODEL_ALIAS_SEED,
  PRIOR_COMPANY_INCONSISTENCIES,
  RECONCILIATION_SEED,
} from "../src/lib/reports/prior-company-seed";

const APPLY = process.argv.includes("--apply");
/** Periods change totals the deployed app reads; write them only together with the deploy. */
const SKIP_PERIODS = process.argv.includes("--skip-periods");

function loadDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const match = env.match(/^DATABASE_URL=(.+)$/m);
    if (!match) throw new Error("DATABASE_URL not found in .env");
    process.env.DATABASE_URL = match[1].trim().replace(/^['"]|['"]$/g, "");
  }
  let raw = process.env.DATABASE_URL;
  if (raw.startsWith("postgres://")) raw = `postgresql://${raw.slice("postgres://".length)}`;
  const url = new URL(raw);
  if (url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

function day(iso: string): Date {
  return new Date(`${iso}T10:00:00.000Z`);
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: loadDatabaseUrl() } } });
  const log = (msg: string) => console.log(`${APPLY ? "" : "[dry run] "}${msg}`);
  const summary: Record<string, unknown> = {};

  try {
    const drafts = buildLegacyMonthEndDrafts();
    const previous: Record<string, unknown> = {};
    for (const draft of SKIP_PERIODS ? [] : drafts) {
      const existing = await prisma.monthEndStockReport.findUnique({
        where: { monthKey: draft.monthKey },
        include: { lines: true },
      });
      const before = existing
        ? summarizeLegacyLines(existing.lines.map((l) => ({ ...l, typeNotes: l.typeNotes ?? "" }))).units
        : null;
      const after = summarizeLegacyLines(draft.lines).units;
      if (existing) {
        previous[draft.monthKey] = {
          sourceKind: existing.sourceKind,
          carriedForwardFromMonthKey: existing.carriedForwardFromMonthKey,
          lines: existing.lines.map((l) => ({
            model: `${l.manufacturer} ${l.model}`,
            newStock: l.newStock,
            repairedUsed: l.repairedUsed,
            toAssess: l.toAssess,
            toDispose: l.toDispose,
            warrantyRepair: l.warrantyRepair,
          })),
        };
      }
      log(
        `${draft.monthKey}: ${existing ? `${existing.sourceKind} (${before} units)` : "new"} → ${draft.sourceKind} (${after} units)`
      );
      if (!APPLY) continue;
      await prisma.$transaction(async (tx) => {
        const report = await tx.monthEndStockReport.upsert({
          where: { monthKey: draft.monthKey },
          create: {
            monthKey: draft.monthKey,
            periodEnding: draft.periodEnding,
            sourceKind: draft.sourceKind,
            sourceFileName: draft.sourceFileName,
            carriedForwardFromMonthKey: draft.carriedForwardFromMonthKey,
            notes: draft.notes,
          },
          update: {
            periodEnding: draft.periodEnding,
            sourceKind: draft.sourceKind,
            sourceFileName: draft.sourceFileName,
            carriedForwardFromMonthKey: draft.carriedForwardFromMonthKey,
            notes: draft.notes,
            importedAt: new Date(),
          },
        });
        await tx.monthEndStockLine.deleteMany({ where: { reportId: report.id } });
        await tx.monthEndStockLine.createMany({
          data: draft.lines.map((line) => ({
            reportId: report.id,
            sortOrder: line.sortOrder,
            groupLabel: line.groupLabel,
            manufacturer: line.manufacturer,
            model: line.model,
            category: line.category,
            tags: line.tags,
            financeType: line.financeType,
            typeNotes: line.typeNotes,
            newStock: line.newStock,
            repairedUsed: line.repairedUsed,
            toAssess: line.toAssess,
            toDispose: line.toDispose,
            warrantyRepair: line.warrantyRepair,
            lineNotes: line.lineNotes,
            memo: Boolean(line.memo),
          })),
        });
      });
    }
    summary.months = SKIP_PERIODS ? [] : drafts.map((d) => d.monthKey);

    let eventsCreated = 0;
    for (const event of JANUARY_2026_EVENTS) {
      const exists = await prisma.priorCompanyEvent.findUnique({ where: { reference: event.reference } });
      const match = await prisma.asset.findFirst({
        where: { serialNumber: { in: event.serials, mode: "insensitive" } },
        select: { id: true, assetName: true, serialNumber: true },
      });
      log(
        `event ${event.reference} ${event.eventDate} ${event.serials.join("/")}: ${exists ? "already stored" : "new"}; register match: ${match ? `${match.assetName} (${match.serialNumber})` : "none"}`
      );
      if (exists || !APPLY) continue;
      await prisma.priorCompanyEvent.create({
        data: {
          eventDate: day(event.eventDate),
          documentDate: event.documentDate ? day(event.documentDate) : null,
          eventType: event.eventType,
          description: event.description,
          assetLabel: event.assetLabel,
          serials: event.serials,
          fromLocation: event.fromLocation,
          toLocation: event.toLocation,
          reference: event.reference,
          crmReference: event.crmReference,
          waybill: event.waybill,
          condition: event.condition,
          evidenceFileName: event.evidenceFileName,
          assetId: match?.id ?? null,
          notes: event.notes,
        },
      });
      eventsCreated += 1;
    }
    summary.eventsCreated = eventsCreated;

    let flagsCreated = 0;
    for (const flag of PRIOR_COMPANY_INCONSISTENCIES) {
      const exists = await prisma.dataInconsistency.findUnique({ where: { key: flag.key } });
      log(`flag ${flag.key}: ${exists ? "already stored" : "new"}`);
      if (exists || !APPLY) continue;
      await prisma.dataInconsistency.create({ data: flag });
      flagsCreated += 1;
    }
    summary.flagsCreated = flagsCreated;

    const aliasCount = await prisma.modelAlias.count();
    log(`model aliases: ${aliasCount} stored, seeding ${MODEL_ALIAS_SEED.length} (duplicates skipped)`);
    if (APPLY) {
      const created = await prisma.modelAlias.createMany({ data: MODEL_ALIAS_SEED, skipDuplicates: true });
      summary.aliasesCreated = created.count;
    }

    const reconCount = await prisma.reconciliationLine.count();
    log(`reconciliation lines: ${reconCount} stored${reconCount ? " (left alone)" : `, seeding ${RECONCILIATION_SEED.length}`}`);
    if (APPLY && reconCount === 0) {
      await prisma.reconciliationLine.createMany({
        data: RECONCILIATION_SEED.map((line, index) => ({ ...line, sortOrder: index })),
      });
      summary.reconciliationSeeded = RECONCILIATION_SEED.length;
    }

    const handover = await prisma.handoverRecord.findUnique({ where: { monthKey: HANDOVER_SEED.monthKey } });
    log(`hand-over record ${HANDOVER_SEED.monthKey}: ${handover ? "already stored" : "new"}`);
    if (APPLY && !handover) {
      await prisma.handoverRecord.create({ data: HANDOVER_SEED });
      summary.handoverCreated = true;
    }

    const note = await prisma.reportNote.findUnique({ where: { key: AUDITOR_NOTES_KEY } });
    log(`auditor notes: ${note ? `version ${note.version} stored (left alone)` : "new, version 1"}`);
    if (APPLY && !note) {
      await prisma.reportNote.create({
        data: {
          key: AUDITOR_NOTES_KEY,
          title: AUDITOR_NOTES_SEED.title,
          markdown: AUDITOR_NOTES_SEED.markdown,
          version: 1,
          updatedBy: "system",
          versions: {
            create: {
              version: 1,
              title: AUDITOR_NOTES_SEED.title,
              markdown: AUDITOR_NOTES_SEED.markdown,
              savedBy: "system",
            },
          },
        },
      });
      summary.notesCreated = true;
    }

    if (APPLY) {
      await prisma.auditLog.create({
        data: {
          actionType: "report.prior_company_phase5_imported",
          notes: SKIP_PERIODS
            ? "Phase 5: 7 January 2026 prior-company movement events; inconsistency flags; aliases; reconciliation lines; hand-over record; auditor notes v1. Periods not changed. No register assets were created or changed."
            : "Phase 5: real 31 Jan 2026 prior-company count; Feb–Apr held by Albatros, May hand-over and Jun no count, each carried forward from 31 Jan 2026; dongle line stored as a memo line; 7 January movement events; inconsistency flags; aliases; reconciliation lines; hand-over record; auditor notes v1. No register assets were created or changed.",
          metadata: JSON.parse(JSON.stringify({ ...summary, previous })),
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
