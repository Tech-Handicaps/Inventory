import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds only what the app needs to run: lifecycle statuses (and optional admin role).
 * Device templates and assets are not seeded — add them in Settings / Register hardware.
 */
async function main() {
  const statuses = [
    {
      code: "new_stock",
      label: "New Stock",
      description: "Received, not yet shelved or processed",
      sortOrder: 1,
    },
    {
      code: "in_stock",
      label: "In Stock",
      description: "Available on hand for deployment or sale",
      sortOrder: 2,
    },
    {
      code: "deployed",
      label: "Deployed",
      description: "Dispatched to customer site or in the field (not on depot stock)",
      sortOrder: 3,
    },
    {
      code: "repair",
      label: "In Repairs",
      description: "Out of circulation for service",
      sortOrder: 4,
    },
    {
      code: "refurbished",
      label: "Refurbished",
      description: "Serviced and ready for reuse",
      sortOrder: 5,
    },
    {
      code: "written_off",
      label: "Written Off",
      description: "Removed from active inventory",
      sortOrder: 6,
    },
  ];

  for (const s of statuses) {
    await prisma.assetStatus.upsert({
      where: { code: s.code },
      update: { label: s.label, description: s.description, sortOrder: s.sortOrder },
      create: s,
    });
  }

  console.log("Asset statuses:", statuses.map((s) => s.code).join(", "));

  const seedAdminId = process.env.SEED_ADMIN_USER_ID?.trim();
  if (seedAdminId) {
    await prisma.userRole.upsert({
      where: { userId: seedAdminId },
      create: { userId: seedAdminId, role: "admin" },
      update: { role: "admin" },
    });
    console.log("UserRole: admin assigned to SEED_ADMIN_USER_ID.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
