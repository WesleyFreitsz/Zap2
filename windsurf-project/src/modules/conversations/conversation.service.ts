import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { LeadService } from "../leads/lead.service";
import { UserService } from "../users/user.service";
import { CreateConversationInput } from "./conversation.schema";

const userService = new UserService();
const leadService = new LeadService();

export class ConversationService {
  async create(data: CreateConversationInput, companyId: string) {
    const assignedToId = await userService.getNextEmployeeRoundRobin(companyId);

    const conversation = await prisma.conversation.create({
      data: {
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactRemoteId: data.contactPhone,
        channel: data.channel as any,
        companyId,
        assignedToId,
        status: "OPEN",
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return this.formatConversation(conversation);
  }

  async findAll(companyId: string, userId: string, role: string) {
    const where: any = { companyId };

    if (role === "EMPLOYEE") {
      where.assignedToId = userId;
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        lead: {
          select: { id: true, name: true, phone: true, avatarUrl: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return conversations
      .filter((conversation) => !this.shouldHideConversation(conversation))
      .map((conversation) => this.formatConversation(conversation));
  }

  async findById(id: string, companyId: string, userId: string, role: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: {
          select: { id: true, name: true, phone: true, avatarUrl: true },
        },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    if (role === "EMPLOYEE" && conversation.assignedToId !== userId) {
      throw new AppError("Access denied to this conversation", 403);
    }

    if (this.shouldHideConversation(conversation)) {
      throw new AppError("Conversation not found", 404);
    }

    return this.formatConversation(conversation);
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

    return prisma.conversation
      .update({
        where: { id: conversationId },
        data: { assignedToId: toUserId, status: "OPEN" },
        include: { assignedTo: { select: { id: true, name: true } } },
      })
      .then((conversation) => this.formatConversation(conversation));
  }

  async transfer(conversationId: string, toUserId: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    const targetUser = await prisma.user.findFirst({
      where: { id: toUserId, companyId, role: "EMPLOYEE", isActive: true },
    });

    if (!targetUser)
      throw new AppError("Target employee not found or inactive", 404);

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedToId: toUserId, status: "TRANSFERRED" },
      include: { assignedTo: { select: { id: true, name: true } } },
    });

    await prisma.message.create({
      data: {
        conversationId,
        sender: "SYSTEM",
        content: `Conversation transferred to ${targetUser.name}`,
      },
    });

    return this.formatConversation(updated);
  }

  async update(
    conversationId: string,
    companyId: string,
    data: {
      contactName?: string;
      contactPhone?: string;
      contactRemoteId?: string;
      contactAvatarUrl?: string | null;
      leadId?: string | null;
      status?: string;
      notes?: string;
      temperature?: string;
    },
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    const updateData: any = {};
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
        updateData.contactPhone = lead.phone;
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
      .then((conversation) => this.formatConversation(conversation));
  }

  async createLeadFromConversation(conversationId: string, companyId: string) {
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
    if (this.shouldHideConversation(conversation)) {
      throw new AppError(
        "This conversation cannot be converted to a lead",
        400,
      );
    }

    const lead = await leadService.findOrCreateByPhone(
      conversation.contactPhone,
      companyId,
      conversation.contactName,
      conversation.contactAvatarUrl,
    );

    return prisma.conversation
      .update({
        where: { id: conversationId },
        data: {
          leadId: lead.id,
          contactPhone: lead.phone,
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
      .then((updatedConversation) =>
        this.formatConversation(updatedConversation),
      );
  }

  async close(conversationId: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "CLOSED" },
    });
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
      conversation.lead?.avatarUrl || conversation.contactAvatarUrl || null;

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
