import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@local";
  const password = "Admin123!"; // change after first login

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin already exists:", email);
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      role: "admin",
      authProvider: "local",
    },
  });

  console.log("Created master admin:", email, "password:", password);
}

main().finally(() => prisma.$disconnect());