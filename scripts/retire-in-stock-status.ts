import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * One-off migration: retire the redundant "in_stock" lifecycle stage.
 *
 * "Available to distribute" is now a derived roll-up of New Stock + Refurbished,
 * so a generic In Stock bucket is removed. Any assets still sitting in in_stock
 * are reassigned to new_stock before the status row is deleted (Asset.statusId
 * is a required FK, so the row can't be dropped while assets reference it).
 *
 * Safe to run multiple times — it no-ops once in_stock is gone.
 *
 * Run with: npx tsx scripts/retire-in-stock-status.ts
 */
async function main() {
  const inStock = await prisma.assetStatus.findUnique({
    where: { code: "in_stock" },
  });

  if (!inStock) {
    console.log('No "in_stock" status found — nothing to retire.');
    return;
  }

  const target = await prisma.assetStatus.findUnique({
    where: { code: "new_stock" },
  });
  if (!target) {
    throw new Error(
      'Cannot retire "in_stock": target status "new_stock" is missing. Run `npm run db:seed` first.'
    );
  }

  const moved = await prisma.asset.updateMany({
    where: { statusId: inStock.id },
    data: { statusId: target.id },
  });

  if (moved.count > 0) {
    console.log(`Reassigned ${moved.count} asset(s) from In Stock → New Stock.`);
  } else {
    console.log("No assets were in the In Stock stage.");
  }

  await prisma.assetStatus.delete({ where: { id: inStock.id } });
  console.log('Deleted the "in_stock" lifecycle status.');
}

main()
  .catch((e) => {
    console.error("retire-in-stock-status failed:", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
