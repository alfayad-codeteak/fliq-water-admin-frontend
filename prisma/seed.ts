import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "owner@proadmin.com" },
    update: {
      password: passwordHash,
      role: Role.OWNER,
      name: "Pro Owner",
    },
    create: {
      email: "owner@proadmin.com",
      name: "Pro Owner",
      password: passwordHash,
      role: Role.OWNER,
    },
  });

  await prisma.product.upsert({
    where: { sku: "SKU-DEMO-001" },
    update: {},
    create: {
      name: "Premium Water Bottle",
      sku: "SKU-DEMO-001",
      description: "Example catalog item for ProAdmin.",
      price: 24.99,
      stock: 120,
      active: true,
    },
  });

  const logs = await prisma.activityLog.count();
  if (logs === 0) {
    await prisma.activityLog.createMany({
      data: [
        { action: "seed", entity: "system", detail: "Database seeded" },
        { action: "login", entity: "auth", detail: "Owner account ready" },
      ],
    });
  }

  await prisma.siteSetting.upsert({
    where: { key: "siteName" },
    update: {},
    create: { key: "siteName", value: "ProAdmin" },
  });

  console.log("Seed complete: owner@proadmin.com / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
