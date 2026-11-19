import type { Prisma } from "@prisma/client";
import prisma from "../../config/prisma";
import { emitConversationUpdated, emitMessageCreated } from "../../realtime";
import { AppError } from "../../utils/AppError";
import { LeadService } from "../leads/lead.service";
import { UserService } from "../users/user.service";
import { assertConversationAccess, conversationScope, type Actor } from "./conversation-access";
import { CreateConversationInput, UpdateConversationInput } from "./conversation.schema";

const userService = new UserService();
const leadService = new LeadService();

export class ConversationService {
  private log(message: string, data?: any) {
    console.log(`🔍 [CONVERSATION] ${message}`, data || "");
  }

  async create(data: CreateConversationInput, companyId: string) {
    this.log("Tentando criar conversa", {
      contactPhone: data.contactPhone,
      leadId: data.leadId,
      companyId,
    });

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        companyId,
        OR: [
          { contactPhone: data.contactPhone },
          data.leadId ? { leadId: data.leadId } : {},
        ].filter((condition) => Object.keys(condition).length > 0),
      },
    });

    if (existingConversation) {
      this.log("Conversa já existe", { id: existingConversation.id });
      throw new AppError(
        "Já existe uma conversa em andamento para este lead",
        409,
      );
    }

    const assignedToId =
      await userService.getNextEmployeeRoundRobin(companyId);

    const conversation = await prisma.conversation.create({
      data: {
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactRemoteId: data.contactPhone,
        channel: data.channel as any,
        companyId,
        assignedToId,
        status: "OPEN",
        leadId: data.leadId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    this.log("Conversa criada", {
      id: conversation.id,
      leadId: data.leadId,
    });

    emitConversationUpdated(conversation);
    return this.formatConversation(conversation);
  }

  async findAll(companyId: string, userId: string, role: string) {
    const where: Prisma.ConversationWhereInput = { companyId, ...conversationScope({ userId, role }) };

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        lead: {
          select: { id: true, name: true, phone: true, avatarUrl: true },
        },
        _count: { select: { messages: true } },
        integration: { select: { provider: true } },
        messages: {
          where: { sender: "CLIENT" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return conversations
      .filter((conversation) => !this.shouldHideConversation(conversation))
      .map(({ integration, messages, ...conversation }) => this.formatConversation({
        ...conversation,
        provider: integration?.provider ?? null,
        lastClientMessageAt: messages[0]?.createdAt ?? null,
      }));
  }

  async findById(id: string, companyId: string, userId: string, role: string) {
    const row = await prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: {
          select: { id: true, name: true, phone: true, avatarUrl: true },
        },
        messages: { orderBy: { createdAt: "asc" } },
        integration: { select: { provider: true } },
      },
    });

    if (!row) throw new AppError("Conversation not found", 404);
    const { integration, ...conversation } = row;

    assertConversationAccess(conversation, { userId, role });

    if (this.shouldHideConversation(conversation)) {
      throw new AppError("Conversation not found", 404);
    }

    const lastClientMessageAt = conversation.messages.reduce<Date | null>(
      (last, message) => message.sender === "CLIENT" ? message.createdAt : last,
      null,
    );
    return this.formatConversation({ ...conversation, provider: integration?.provider ?? null, lastClientMessageAt });
  }

  async assign(conversationId: string, toUserId: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    const targetUser = await prisma.user.findFirst({
      where: { id: toUserId, companyId, isActive: true },
    });

    if (!targetUser)
      throw new AppError("Target user not found or inactive", 404);

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedToId: toUserId, status: "OPEN" },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
    emitConversationUpdated(updated, conversation.assignedToId);
    return this.formatConversation(updated);
  }

  async transfer(conversationId: string, toUserId: string, companyId: string, actor: Actor) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);
    assertConversationAccess(conversation, actor);

    const targetUser = await prisma.user.findFirst({
      where: {
        id: toUserId,
        companyId,
        role: "EMPLOYEE",
        isActive: true,
      },
    });

    if (!targetUser)
      throw new AppError("Target employee not found or inactive", 404);

    const [updated] = await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedToId: toUserId, status: "TRANSFERRED" },
        include: { assignedTo: { select: { id: true, name: true } } },
      }),
      prisma.message.create({
        data: {
          conversationId,
          sender: "SYSTEM",
          content: `Conversation transferred to ${targetUser.name}`,
        },
      }),
    ]);

    emitConversationUpdated(updated, conversation.assignedToId);
    emitMessageCreated(updated);
    return this.formatConversation(updated);
  }

  async update(
    conversationId: string,
    companyId: string,
    data: UpdateConversationInput,
    actor: Actor,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);
    assertConversationAccess(conversation, actor);

    const updateData: Prisma.ConversationUncheckedUpdateInput = {};

    if (data.contactName !== undefined)
      updateData.contactName = data.contactName;

    if (data.contactPhone !== undefined)
      updateData.contactPhone = data.contactPhone;

    if (data.contactRemoteId !== undefined)
      updateData.contactRemoteId = data.contactRemoteId;

    if (data.contactAvatarUrl !== undefined)
      updateData.contactAvatarUrl = data.contactAvatarUrl;

    if (data.leadId !== undefined) {
      if (data.leadId === null) {
        updateData.leadId = null;
      } else {
        const lead = await prisma.lead.findFirst({
          where: { id: data.leadId, companyId },
        });

        if (!lead) throw new AppError("Lead not found", 404);

        updateData.leadId = lead.id;
        if (lead.phone) updateData.contactPhone = lead.phone;

        if (lead.avatarUrl) {
          updateData.contactAvatarUrl = lead.avatarUrl;
        }
      }
    }

    if (data.status !== undefined) updateData.status = data.status;

    return prisma.conversation
      .update({
        where: { id: conversationId },
        data: updateData,
        include: {
          assignedTo: { select: { id: true, name: true } },
          lead: {
            select: { id: true, name: true, phone: true, avatarUrl: true },
          },
          _count: { select: { messages: true } },
        },
      })
      .then((updated) => {
        emitConversationUpdated(updated);
        return this.formatConversation(updated);
      });
  }

  async createLeadFromConversation(
    conversationId: string,
    companyId: string,
    actor: Actor,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      include: {
        assignedTo: { select: { id: true, name: true } },
        lead: {
          select: { id: true, name: true, phone: true, avatarUrl: true },
        },
        _count: { select: { messages: true } },
      },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);
    assertConversationAccess(conversation, actor);

    if (this.shouldHideConversation(conversation)) {
      throw new AppError(
        "This conversation cannot be converted to a lead",
        400,
      );
    }

    const lead = await leadService.findOrCreateForConversation(conversation, companyId);

    return prisma.conversation
      .update({
        where: { id: conversationId },
        data: {
          leadId: lead.id,
          ...(lead.phone && { contactPhone: lead.phone }),
          contactAvatarUrl:
            lead.avatarUrl || conversation.contactAvatarUrl || null,
        },
        include: {
          assignedTo: { select: { id: true, name: true } },
          lead: {
            select: { id: true, name: true, phone: true, avatarUrl: true },
          },
          _count: { select: { messages: true } },
        },
      })
      .then((updated) => {
        emitConversationUpdated(updated);
        return this.formatConversation(updated);
      });
  }

  async close(conversationId: string, companyId: string, actor: Actor) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);
    assertConversationAccess(conversation, actor);

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "CLOSED" },
    });
    emitConversationUpdated(updated);
    return updated;
  }

  private shouldHideConversation(conversation: {
    contactName?: string | null;
    contactPhone?: string | null;
    contactRemoteId?: string | null;
  }) {
    const values = [
      conversation.contactName,
      conversation.contactPhone,
      conversation.contactRemoteId,
    ]
      .map((value) =>
        String(value || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);

    return values.some(
      (value) => value === "status" || value.includes("broadcast"),
    );
  }

  private getDisplayPhone(phone?: string | null) {
    const raw = String(phone || "").trim();
    if (!raw) return "";

    const base = raw.includes("@") ? raw.split("@")[0] : raw;
    const digits = base.replace(/\D/g, "");

    return digits || base;
  }

  private hasUsableName(name?: string | null) {
    const value = String(name || "").trim();
    if (!value) return false;

    const normalized = value.toLowerCase();
    if (normalized === "status" || normalized.includes("broadcast")) {
      return false;
    }

    return !value.includes("@");
  }

  private formatConversation<T extends Record<string, any>>(conversation: T) {
    const rawPhone =
      conversation.lead?.phone ||
      conversation.contactPhone ||
      conversation.contactRemoteId;

    const displayPhone = this.getDisplayPhone(rawPhone);

    const displayName = this.hasUsableName(conversation.lead?.name)
      ? conversation.lead.name
      : this.hasUsableName(conversation.contactName)
        ? conversation.contactName
        : displayPhone || "Contato sem nome";

    const avatarUrl =
      conversation.lead?.avatarUrl ||
      conversation.contactAvatarUrl ||
      null;

    return {
      ...conversation,
      displayName,
      displayPhone,
      avatarUrl,
      contactAvatarUrl: avatarUrl,
      contactRemoteId:
        conversation.contactRemoteId || conversation.contactPhone,
      isBroadcast: this.shouldHideConversation(conversation),
    };
  }
}
