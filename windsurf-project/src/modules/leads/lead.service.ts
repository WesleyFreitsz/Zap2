import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateLeadInput, UpdateLeadInput } from "./lead.schema";
import { normalizePhone } from "../../utils/phone";

export class LeadService {
  async create(data: CreateLeadInput, companyId: string) {
    const phone = normalizePhone(data.phone);

    const existing = await prisma.lead.findUnique({
      where: { phone_companyId: { phone, companyId } },
    });
    if (existing) {
      throw new AppError("Lead with this phone already exists", 409);
    }

    return prisma.lead.create({
      data: {
        ...data,
        phone,
        companyId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(
    companyId: string,
    filters: {
      temperature?: string;
      status?: string;
      assignedToId?: string;
      search?: string;
    } = {},
    userRole?: string,
    userId?: string,
  ) {
    const where: any = { companyId };

    if (filters.temperature) where.temperature = filters.temperature;
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;

    // EMPLOYEE only sees their own leads
    if (userRole === "EMPLOYEE" && userId) {
      where.assignedToId = userId;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { conversations: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findById(id: string, companyId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, status: true, updatedAt: true },
        },
      },
    });
    if (!lead) throw new AppError("Lead not found", 404);
    return lead;
  }

  async update(id: string, companyId: string, data: UpdateLeadInput) {
    const lead = await prisma.lead.findFirst({ where: { id, companyId } });
    if (!lead) throw new AppError("Lead not found", 404);

    const updateData: any = { ...data };
    if (data.phone) {
      updateData.phone = normalizePhone(data.phone);
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    });

    const conversationUpdateData: Record<string, string> = {};

    if (updateData.name) {
      conversationUpdateData.contactName = updateData.name;
    }

    if (updateData.phone) {
      conversationUpdateData.contactPhone = updateData.phone;
    }

    if (Object.keys(conversationUpdateData).length > 0) {
      await prisma.conversation.updateMany({
        where: { leadId: id, companyId },
        data: conversationUpdateData,
      });
    }

    return updatedLead;
  }

  async delete(id: string, companyId: string) {
    const lead = await prisma.lead.findFirst({ where: { id, companyId } });
    if (!lead) throw new AppError("Lead not found", 404);

    await prisma.lead.delete({ where: { id } });
    return { message: "Lead deleted successfully" };
  }

  async findOrCreateByPhone(
    phone: string,
    companyId: string,
    name?: string,
    avatarUrl?: string | null,
  ) {
    const normalized = normalizePhone(phone);

    let lead = await prisma.lead.findUnique({
      where: { phone_companyId: { phone: normalized, companyId } },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          name: name || normalized,
          phone: normalized,
          avatarUrl: avatarUrl || null,
          companyId,
          temperature: "COLD",
          status: "NEW",
        },
      });
    } else if (avatarUrl && !lead.avatarUrl) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { avatarUrl },
      });
    }

    return lead;
  }
}
