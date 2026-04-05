import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create Super Admin (no company)
  const superAdminPassword = await bcrypt.hash("super123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@omnichannel.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "superadmin@omnichannel.com",
      password: superAdminPassword,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`Super Admin created: ${superAdmin.email}`);

  // Seed Plans
  const plans = [
    {
      name: "Basic",
      slug: "basic",
      price: 97,
      annualPrice: 77.6,
      maxNumbers: 1,
      maxEmployees: 5,
      maxTeamLeaders: 0,
      features: [
        "1 número WhatsApp",
        "Até 5 funcionários",
        "Suporte por email",
      ],
      founderSlots: 10,
    },
    {
      name: "Plus",
      slug: "plus",
      price: 197,
      annualPrice: 157.6,
      maxNumbers: 2,
      maxEmployees: 15,
      maxTeamLeaders: 0,
      features: [
        "2 números WhatsApp",
        "Até 15 funcionários",
        "Suporte por email",
        "Analytics avançado",
      ],
      founderSlots: 10,
    },
    {
      name: "Pro",
      slug: "pro",
      price: 397,
      annualPrice: 317.6,
      maxNumbers: 4,
      maxEmployees: 40,
      maxTeamLeaders: 4,
      features: [
        "4 números WhatsApp",
        "Até 40 funcionários",
        "4 líderes de equipe",
        "Suporte prioritário",
        "Analytics avançado",
      ],
      founderSlots: 10,
    },
  ];

  for (const plan of plans) {
    await (prisma as any).plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        price: plan.price,
        annualPrice: plan.annualPrice,
        maxNumbers: plan.maxNumbers,
        maxEmployees: plan.maxEmployees,
        maxTeamLeaders: plan.maxTeamLeaders,
        features: plan.features,
        founderSlots: plan.founderSlots,
      },
      create: plan,
    });
    console.log(`Plan seeded: ${plan.name} (R$${plan.price}/mês)`);
  }

  console.log("\nSeed completed successfully!");
  console.log("\n--- Login Credentials ---");
  console.log("Super Admin: superadmin@omnichannel.com / super123");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
