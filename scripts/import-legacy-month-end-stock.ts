/**
 * Archive the prior-company month-end stock takes (Oct 2025–May 2026)
 * and add any missing device templates for those models.
 *
 * Does not create serialised assets. Safe to run again: each month is replaced,
 * existing templates are left unchanged.
 *
 * Run with: npm run db:import-legacy-month-end
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { LEGACY_STOCK_SKUS } from "../src/lib/reports/legacy-month-end-catalog";
import { buildLegacyMonthEndDrafts } from "../src/lib/reports/legacy-month-end";

function loadDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    const env = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    const match = env.match(/^DATABASE_URL=(.+)$/m);
    if (!match) throw new Error("DATABASE_URL not found in .env");
    process.env.DATABASE_URL = match[1].trim().replace(/^['"]|['"]$/g, "");
  }
  let raw = process.env.DATABASE_URL;
  if (raw.startsWith("postgres://")) {
    raw = `postgresql://${raw.slice("postgres://".length)}`;
  }
  const url = new URL(raw);
  if (url.port === "6543") url.port = "5432";
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: loadDatabaseUrl() } },
  });

  try {
    const drafts = buildLegacyMonthEndDrafts();
    for (const draft of drafts) {
      const report = await prisma.monthEndStockReport.upsert({
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
      await prisma.monthEndStockLine.deleteMany({ where: { reportId: report.id } });
      await prisma.monthEndStockLine.createMany({
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
        })),
      });
      console.log(`Stored ${draft.monthKey} (${draft.lines.length} lines)`);
    }

    let created = 0;
    let skipped = 0;
    for (const sku of LEGACY_STOCK_SKUS) {
      const existing = await prisma.deviceTemplate.findUnique({
        where: {
          manufacturer_model: {
            manufacturer: sku.manufacturer,
            model: sku.model,
          },
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.deviceTemplate.create({
        data: {
          label: `${sku.manufacturer} ${sku.model}`,
          manufacturer: sku.manufacturer,
          model: sku.model,
          category: sku.category,
          tags: sku.tags,
          notes: `${sku.typeNotes} Catalog entry from the prior-company month-end stock take. No serialised units were created.`,
        },
      });
      created += 1;
    }
    console.log(`Device templates created: ${created}, already present: ${skipped}`);

    await prisma.auditLog.create({
      data: {
        actionType: "report.legacy_month_end_imported",
        notes:
          "Imported prior-company month-end stock takes for Oct 2025–May 2026. Quantity records only; live assets were not created.",
        metadata: {
          months: drafts.map((draft) => draft.monthKey),
          templatesCreated: created,
          templatesSkipped: skipped,
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
