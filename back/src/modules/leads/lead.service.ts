import type { Conversation, Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import type { Actor } from "../conversations/conversation-access";
import { CreateLeadInput, UpdateLeadInput } from "./lead.schema";
import { normalizePhone } from "../../utils/phone";

const leadInclude = {
  assignedTo: { select: { id: true, name: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.LeadInclude;

type LeadWithTags = Prisma.LeadGetPayload<{ include: typeof leadInclude }>;

function toLeadResponse<T extends Pick<LeadWithTags, "tags">>({ tags, ...lead }: T) {
  return { ...lead, tags: tags.map(({ tag }) => tag) };
}

function leadScope(actor: Actor): Prisma.LeadWhereInput {
  return actor.role === "EMPLOYEE" ? { assignedToId: actor.userId } : {};
}

async function assertTagsBelongToCompany(tagIds: string[], companyId: string) {
  const unique = [...new Set(tagIds)];
  const found = await prisma.tag.count({ where: { id: { in: unique }, companyId } });
  if (found !== unique.length) throw new AppError("Tag inválida para esta empresa", 422);
  return unique;
}

async function resolveAssignee(
  assignedToId: string | null | undefined,
  companyId: string,
  actor: Actor,
): Promise<string | null | undefined> {
  if (actor.role === "EMPLOYEE") return undefined;
  if (!assignedToId) return assignedToId;
  const user = await prisma.user.findFirst({
    where: { id: assignedToId, companyId, isActive: true },
    select: { id: true },
  });
  if (!user) throw new AppError("Responsável inválido para esta empresa", 422);
  return user.id;
}

export class LeadService {
  async create(data: CreateLeadInput, companyId: string, actor: Actor) {
    const phone = normalizePhone(data.phone);

    const existing = await prisma.lead.findUnique({
      where: { phone_companyId: { phone, companyId } },
    });
    if (existing) throw new AppError("Lead com este telefone já existe", 409);

    const tagIds = await assertTagsBelongToCompany(data.tags ?? [], companyId);
    const assignedToId = actor.role === "EMPLOYEE"
      ? actor.userId
      : await resolveAssignee(data.assignedToId, companyId, actor);

    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone,
        email: data.email,
        temperature: data.temperature,
        status: data.status,
        notes: data.notes,
        companyId,
        assignedToId,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: leadInclude,
    });

    return toLeadResponse(lead);
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
      include: { ...leadInclude, _count: { select: { conversations: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return leads.map(toLeadResponse);
  }

  async findById(id: string, companyId: string, actor: Actor) {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId, ...leadScope(actor) },
      include: {
        ...leadInclude,
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, status: true, updatedAt: true },
        },
      },
    });

    if (!lead) throw new AppError("Lead not found", 404);

    return toLeadResponse(lead);
  }

  async update(id: string, companyId: string, data: UpdateLeadInput, actor: Actor) {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId, ...leadScope(actor) },
    });

    if (!lead) throw new AppError("Lead not found", 404);

    const { tags, assignedToId, phone, ...fields } = data;
    const updateData: Prisma.LeadUncheckedUpdateInput = { ...fields };

    if (phone) updateData.phone = normalizePhone(phone);

    if (assignedToId !== undefined) {
      const resolved = await resolveAssignee(assignedToId, companyId, actor);
      if (resolved !== undefined) updateData.assignedToId = resolved;
    }

    if (tags) {
      const tagIds = await assertTagsBelongToCompany(tags, companyId);
      updateData.tags = { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) };
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: updateData,
      include: leadInclude,
    });

    const conversationUpdateData: Prisma.ConversationUpdateManyMutationInput = {};
    if (fields.name) conversationUpdateData.contactName = fields.name;
    if (typeof updateData.phone === "string") conversationUpdateData.contactPhone = updateData.phone;

    if (Object.keys(conversationUpdateData).length > 0) {
      await prisma.conversation.updateMany({
        where: { leadId: id, companyId },
        data: conversationUpdateData,
      });
    }

    return toLeadResponse(updatedLead);
  }

  async delete(id: string, companyId: string, actor: Actor) {
    const { count } = await prisma.lead.deleteMany({
      where: { id, companyId, ...leadScope(actor) },
    });

    if (count === 0) throw new AppError("Lead not found", 404);

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