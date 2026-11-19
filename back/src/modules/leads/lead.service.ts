import type { Conversation } from "@prisma/client";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { CreateLeadInput, UpdateLeadInput } from "./lead.schema";
import { normalizePhone } from "../../utils/phone";

export class LeadService {
  async create(data: CreateLeadInput, companyId: string) {
    const phone = normalizePhone(data.phone);

    console.log("🔍 [LEAD] Verificando telefone:", {
      original: data.phone,
      normalized: phone,
      companyId,
    });

    const existing = await prisma.lead.findUnique({
      where: { phone_companyId: { phone, companyId } },
    });

    if (existing) {
      console.log("❌ [LEAD] Telefone já existe:", existing.phone);
      throw new AppError("Lead com este telefone já existe", 409);
    }

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone,
        email: data.email,
        temperature: data.temperature,
        status: data.status,
        notes: data.notes,
        companyId,
        assignedToId: data.assignedToId,
        tags: data.tags
          ? {
              connect: data.tags.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        tags: true,
      },
    });

    console.log("✅ [LEAD] Lead criado:", {
      id: lead.id,
      phone: lead.phone,
    });

    return lead;
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

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        tags: true, // 👈 substitui SQL bruto
        _count: { select: { conversations: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log("📋 [LEAD] Leads encontrados:", leads.length);

    return leads;
  }

  async findById(id: string, companyId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        tags: true,
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
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
    });

    if (!lead) throw new AppError("Lead not found", 404);

    const updateData: any = { ...data };

    if (data.phone) {
      updateData.phone = normalizePhone(data.phone);
    }

    if (data.tags) {
      updateData.tags = {
        set: data.tags.map((id) => ({ id })), // 👈 limpa + recria
      };
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true } },
        tags: true,
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
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
    });

    if (!lead) throw new AppError("Lead not found", 404);

    await prisma.lead.delete({ where: { id } });

    return { message: "Lead deletado com sucesso" };
  }

  async findOrCreateForConversation(
    conversation: Pick<
      Conversation,
      "channel" | "contactPhone" | "contactRemoteId" | "contactName" | "contactAvatarUrl"
    >,
    companyId: string,
  ) {
    const { channel, contactPhone, contactName, contactAvatarUrl } = conversation;
    if (channel === "WHATSAPP") {
      return this.findOrCreateByPhone(contactPhone, companyId, contactName, contactAvatarUrl);
    }

    const contactRemoteId = conversation.contactRemoteId || contactPhone;
    const name = contactName && contactName !== contactRemoteId ? contactName : "Contato sem nome";
    return prisma.lead.upsert({
      where: { companyId_channel_contactRemoteId: { companyId, channel, contactRemoteId } },
      create: {
        name,
        channel,
        contactRemoteId,
        avatarUrl: contactAvatarUrl || null,
        companyId,
        temperature: "COLD",
        status: "NEW",
      },
      update: {},
    });
  }

  async findOrCreateByPhone(
    phone: string,
    companyId: string,
    name?: string,
    avatarUrl?: string | null,
  ) {
    const normalized = normalizePhone(phone);

    let lead = await prisma.lead.findUnique({
      where: {
        phone_companyId: { phone: normalized, companyId },
      },
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

      console.log("✅ [LEAD] Criado via findOrCreate:", lead.id);
    } else if (avatarUrl && !lead.avatarUrl) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { avatarUrl },
      });
    }

    return lead;
  }
}