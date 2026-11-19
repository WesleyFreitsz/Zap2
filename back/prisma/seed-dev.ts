import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const DEV_PASSWORD = "zap2-dev-123";
const ADMIN_EMAIL = "admin@zap2.test";
const EMPLOYEE_EMAIL = "atendente@zap2.test";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-dev não roda em produção");
  }

  await prisma.company.deleteMany({ where: { id: DEV_COMPANY_ID } });

  const password = await bcrypt.hash(DEV_PASSWORD, 12);

  const company = await prisma.company.create({
    data: {
      id: DEV_COMPANY_ID,
      name: "Loja Teste",
      plan: "pro",
      primaryColor: "#4c216b",
      secondaryColor: "#f9692a",
    },
  });

  const admin = await prisma.user.create({
    data: { name: "Ana Admin", email: ADMIN_EMAIL, password, role: "ADMIN", companyId: company.id },
  });
  const employee = await prisma.user.create({
    data: { name: "Bruno Atendente", email: EMPLOYEE_EMAIL, password, role: "EMPLOYEE", companyId: company.id },
  });

  const [vip, duvida] = await Promise.all([
    prisma.tag.create({ data: { name: "VIP", color: "#f9692a", companyId: company.id } }),
    prisma.tag.create({ data: { name: "Dúvida", color: "#4c216b", companyId: company.id } }),
  ]);

  const leads = await Promise.all(
    [
      { name: "Carla Souza", phone: "5541999990001", temperature: "HOT" as const, status: "IN_ATTENDANCE" as const },
      { name: "Diego Lima", phone: "5541999990002", temperature: "WARM" as const, status: "FOLLOW_UP" as const },
      { name: "Elisa Rocha", phone: "5541999990003", temperature: "COLD" as const, status: "NEW" as const },
      { name: "Fábio Nunes", phone: "5541999990004", temperature: "CONVERTED" as const, status: "CLOSED" as const },
    ].map((lead) =>
      prisma.lead.create({ data: { ...lead, companyId: company.id, assignedToId: employee.id } }),
    ),
  );
  await prisma.leadTag.create({ data: { leadId: leads[0].id, tagId: vip.id } });

  const conversations = [
    {
      lead: leads[0],
      assignedToId: employee.id,
      messages: [
        ["CLIENT", "Oi! A camiseta preta M ainda tem?"],
        ["USER", "Oi, Carla! Tem sim, quer que eu separe?"],
        ["CLIENT", "Quero. Quanto fica o frete pra Curitiba?"],
      ],
    },
    {
      lead: leads[1],
      assignedToId: employee.id,
      messages: [
        ["CLIENT", "Vocês trocam se não servir?"],
        ["USER", "Trocamos em até 30 dias, Diego."],
      ],
    },
    {
      lead: leads[2],
      assignedToId: admin.id,
      messages: [["CLIENT", "Qual o horário de funcionamento?"]],
    },
  ] as const;

  for (const [index, item] of conversations.entries()) {
    const conversation = await prisma.conversation.create({
      data: {
        contactName: item.lead.name,
        contactPhone: item.lead.phone,
        companyId: company.id,
        leadId: item.lead.id,
        assignedToId: item.assignedToId,
        status: "OPEN",
      },
    });
    await prisma.message.createMany({
      data: item.messages.map(([sender, content], position) => ({
        conversationId: conversation.id,
        sender,
        content,
        createdAt: minutesAgo((conversations.length - index) * 30 - position),
      })),
    });
    if (index === 0) {
      await prisma.conversationTag.create({ data: { conversationId: conversation.id, tagId: duvida.id } });
      await prisma.scheduledMessage.createMany({
        data: [
          { conversationId: conversation.id, companyId: company.id, content: "Carla, seu pedido já foi postado!", sendAt: hoursFromNow(20) },
          {
            conversationId: conversation.id,
            companyId: company.id,
            content: "Lembrete: promoção termina hoje.",
            sendAt: minutesAgo(90),
            status: "FAILED",
            error: "Falha no envio pelo WhatsApp",
          },
        ],
      });
    }
  }

  await prisma.product.createMany({
    data: [
      { name: "Camiseta preta", description: "Algodão, tamanhos P a GG", price: 79.9, stock: 12, category: "Camisetas", code: "CAM-001", companyId: company.id },
      { name: "Moletom cinza", description: "Flanelado", price: 189.9, promotionalPrice: 159.9, stock: 4, category: "Moletons", code: "MOL-002", companyId: company.id },
    ],
  });

  await prisma.aiConfig.create({
    data: {
      companyId: company.id,
      aiName: "Assistente Loja Teste",
      productContext: "Frete para o Sul: R$ 15. Trocas em até 30 dias.",
    },
  });

  console.log(`Empresa de teste: ${company.name}`);
  console.log(`Logins: ${ADMIN_EMAIL} (admin) e ${EMPLOYEE_EMAIL} (funcionário). Senha em DEV_PASSWORD neste arquivo.`);
}

main()
  .catch((error) => {
    console.error("Seed dev error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
