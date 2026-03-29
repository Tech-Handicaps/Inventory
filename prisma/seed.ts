import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      code: "repair",
      label: "In Repairs",
      description: "Out of circulation for service",
      sortOrder: 3,
    },
    {
      code: "refurbished",
      label: "Refurbished",
      description: "Serviced and ready for reuse",
      sortOrder: 4,
    },
    {
      code: "written_off",
      label: "Written Off",
      description: "Removed from active inventory",
      sortOrder: 5,
    },
  ];

  for (const s of statuses) {
    await prisma.assetStatus.upsert({
      where: { code: s.code },
      update: { label: s.label, description: s.description, sortOrder: s.sortOrder },
      create: s,
    });
  }

  console.log("Seeded asset statuses:", statuses.map((s) => s.code).join(", "));

  const deviceTemplates = [
    {
      label: "Lenovo ThinkPad T14 Gen 3",
      manufacturer: "Lenovo",
      model: "T14 G3",
      category: "Laptop",
      notes: "14\" business laptop",
    },
    {
      label: "Dell UltraSharp 27",
      manufacturer: "Dell",
      model: "U2723QE",
      category: "Monitor",
      notes: "27\" QHD USB-C",
    },
    {
      label: "Apple MacBook Pro 14",
      manufacturer: "Apple",
      model: "M3 Pro",
      category: "Laptop",
    },
    {
      label: "HP EliteDesk 800 G9",
      manufacturer: "HP",
      model: "800 G9",
      category: "Desktop",
    },
    {
      label: "Microsoft Surface Pro 9",
      manufacturer: "Microsoft",
      model: "Surface Pro 9",
      category: "Tablet",
    },
    {
      label: "Lenovo ThinkCentre M90q",
      manufacturer: "Lenovo",
      model: "M90q",
      category: "Desktop",
    },
    {
      label: "Epson EB-X49",
      manufacturer: "Epson",
      model: "EB-X49",
      category: "AV",
      notes: "Projector",
    },
  ];

  for (const dt of deviceTemplates) {
    await prisma.deviceTemplate.upsert({
      where: {
        manufacturer_model: {
          manufacturer: dt.manufacturer,
          model: dt.model,
        },
      },
      update: {
        label: dt.label,
        category: dt.category,
        notes: dt.notes ?? null,
      },
      create: {
        label: dt.label,
        manufacturer: dt.manufacturer,
        model: dt.model,
        category: dt.category,
        notes: dt.notes ?? null,
      },
    });
  }

  console.log("Seeded device templates:", deviceTemplates.length);

  const byCode = Object.fromEntries(
    (await prisma.assetStatus.findMany()).map((x) => [x.code, x.id])
  );

  const templateByMakeModel = Object.fromEntries(
    (
      await prisma.deviceTemplate.findMany({
        select: { id: true, manufacturer: true, model: true },
      })
    ).map((t) => [`${t.manufacturer}\0${t.model}`, t.id])
  );

  const samples: {
    assetName: string;
    category: string;
    serialNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    statusCode: keyof typeof byCode;
    reason?: string | null;
  }[] = [
    {
      assetName: "ThinkPad T14 Gen 3",
      category: "Laptop",
      serialNumber: "PC24-001",
      manufacturer: "Lenovo",
      model: "T14 G3",
      statusCode: "new_stock",
    },
    {
      assetName: "Dell UltraSharp 27",
      category: "Monitor",
      serialNumber: "MON-8842",
      manufacturer: "Dell",
      model: "U2723QE",
      statusCode: "new_stock",
    },
    {
      assetName: "MacBook Pro 14",
      category: "Laptop",
      serialNumber: "MBP-7721",
      manufacturer: "Apple",
      model: "M3 Pro",
      statusCode: "in_stock",
    },
    {
      assetName: "HP EliteDesk 800",
      category: "Desktop",
      serialNumber: "DT-3391",
      manufacturer: "HP",
      model: "800 G9",
      statusCode: "in_stock",
    },
    {
      assetName: "Surface Pro 9",
      category: "Tablet",
      serialNumber: "TAB-1104",
      manufacturer: "Microsoft",
      model: "Surface Pro 9",
      statusCode: "repair",
      reason: "Screen replacement",
    },
    {
      assetName: "Lenovo ThinkCentre M90q",
      category: "Desktop",
      serialNumber: "DT-2200",
      manufacturer: "Lenovo",
      model: "M90q",
      statusCode: "refurbished",
    },
    {
      assetName: "Old projector (damaged)",
      category: "AV",
      serialNumber: null,
      manufacturer: "Epson",
      model: "EB-X49",
      statusCode: "written_off",
      reason: "Beyond economical repair",
    },
  ];

  for (const row of samples) {
    const statusId = byCode[row.statusCode];
    if (!statusId) continue;

    if (row.serialNumber) {
      await prisma.asset.upsert({
        where: { serialNumber: row.serialNumber },
        update: {},
        create: {
          assetName: row.assetName,
          category: row.category,
          serialNumber: row.serialNumber,
          manufacturer: row.manufacturer,
          model: row.model,
          statusId,
          reason: row.reason ?? null,
          deviceTemplateId:
            row.manufacturer && row.model
              ? templateByMakeModel[`${row.manufacturer}\0${row.model}`]
              : undefined,
        },
      });
    } else {
      const existing = await prisma.asset.findFirst({
        where: { assetName: row.assetName, category: row.category },
      });
      if (!existing) {
        await prisma.asset.create({
          data: {
            assetName: row.assetName,
            category: row.category,
            serialNumber: null,
            manufacturer: row.manufacturer,
            model: row.model,
            statusId,
            reason: row.reason ?? null,
            deviceTemplateId:
              row.manufacturer && row.model
                ? templateByMakeModel[`${row.manufacturer}\0${row.model}`]
                : undefined,
          },
        });
      }
    }
  }

  console.log("Sample hardware rows ensured.");

  const seedAdminId = process.env.SEED_ADMIN_USER_ID?.trim();
  if (seedAdminId) {
    await prisma.userRole.upsert({
      where: { userId: seedAdminId },
      create: { userId: seedAdminId, role: "management" },
      update: { role: "management" },
    });
    console.log("UserRole: management assigned to SEED_ADMIN_USER_ID.");
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
