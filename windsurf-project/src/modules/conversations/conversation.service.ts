import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { UserService } from "../users/user.service";
import { CreateConversationInput } from "./conversation.schema";

const userService = new UserService();

export class ConversationService {
  async create(data: CreateConversationInput, companyId: string) {
    const assignedToId = await userService.getNextEmployeeRoundRobin(companyId);

    const conversation = await prisma.conversation.create({
      data: {
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        channel: data.channel as any,
        companyId,
        assignedToId,
        status: "OPEN",
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return conversation;
  }

  async findAll(companyId: string, userId: string, role: string) {
    const where: any = { companyId };

    if (role === "EMPLOYEE") {
      where.assignedToId = userId;
    }

    return prisma.conversation.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findById(id: string, companyId: string, userId: string, role: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    if (role === "EMPLOYEE" && conversation.assignedToId !== userId) {
      throw new AppError("Access denied to this conversation", 403);
    }

    return conversation;
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

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedToId: toUserId, status: "OPEN" },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
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

    return updated;
  }

  async update(
    conversationId: string,
    companyId: string,
    data: {
      contactName?: string;
      contactPhone?: string;
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
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    });
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
}
