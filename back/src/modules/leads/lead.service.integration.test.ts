import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import type { Actor } from "../conversations/conversation-access";
import { LeadService } from "./lead.service";

const DEV_COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_COMPANY_ID = "00000000-0000-4000-8000-0000000000f1";
const OTHER_LEAD_PHONE = "5511900000999";

const leadService = new LeadService();

function rejectsWith(status: number) {
  return (error: unknown) => error instanceof AppError && error.statusCode === status;
}

describe("LeadService against the seed-dev database", { skip: !process.env.DATABASE_URL }, () => {
  let admin: Actor;
  let employee: Actor;
  let employeeLeadId: string;
  let adminLeadId: string;
  let foreignTagId: string;
  let foreignUserId: string;

  before(async () => {
    const [adminUser, employeeUser] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "admin@zap2.test" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "atendente@zap2.test" } }),
    ]);
    admin = { userId: adminUser.id, role: adminUser.role };
    employee = { userId: employeeUser.id, role: employeeUser.role };

    employeeLeadId = (await prisma.lead.findFirstOrThrow({
      where: { companyId: DEV_COMPANY_ID, assignedToId: employee.userId },
    })).id;

    await prisma.company.deleteMany({ where: { id: OTHER_COMPANY_ID } });
    await prisma.lead.deleteMany({ where: { companyId: DEV_COMPANY_ID, phone: OTHER_LEAD_PHONE } });
    const otherCompany = await prisma.company.create({
      data: {
        id: OTHER_COMPANY_ID,
        name: "Outra Empresa",
        tags: { create: { name: "Externa" } },
        users: { create: { name: "Outro Admin", email: "outro-admin@zap2.test", password: "-", role: "ADMIN" } },
      },
      include: { tags: true, users: true },
    });
    foreignTagId = otherCompany.tags[0].id;
    foreignUserId = otherCompany.users[0].id;

    adminLeadId = (await prisma.lead.create({
      data: { name: "Lead do admin", phone: OTHER_LEAD_PHONE, companyId: DEV_COMPANY_ID, assignedToId: admin.userId },
    })).id;
  });

  after(async () => {
    await prisma.lead.deleteMany({ where: { id: adminLeadId } });
    await prisma.company.deleteMany({ where: { id: OTHER_COMPANY_ID } });
    await prisma.$disconnect();
  });

  test("rejects a tag from another company with 422", async () => {
    await assert.rejects(
      leadService.update(employeeLeadId, DEV_COMPANY_ID, { tags: [foreignTagId] }, admin),
      rejectsWith(422),
    );
  });

  test("rejects an assignee from another company with 422", async () => {
    await assert.rejects(
      leadService.update(employeeLeadId, DEV_COMPANY_ID, { assignedToId: foreignUserId }, admin),
      rejectsWith(422),
    );
  });

  test("hides a lead assigned to someone else from the employee with 404", async () => {
    await assert.rejects(
      leadService.update(adminLeadId, DEV_COMPANY_ID, { name: "Invasão" }, employee),
      rejectsWith(404),
    );
  });
});
