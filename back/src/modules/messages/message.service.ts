import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { EvolutionService } from "../integrations/evolution/evolution.service";
import { SendMessageInput } from "./message.schema";

const evolutionService = new EvolutionService();

export class MessageService {
  async send(
    data: SendMessageInput,
    companyId: string,
    userId: string,
    role: string,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: data.conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    if (role === "EMPLOYEE" && conversation.assignedToId !== userId) {
      throw new AppError("Access denied to this conversation", 403);
    }

    let externalId: string | null = null;

    if (conversation.channel === "WHATSAPP" && data.sender !== "CLIENT") {
      try {
        const result = await evolutionService.sendMessage(
          companyId,
          conversation.contactPhone,
          data.content,
        );
        externalId = result.externalId;
      } catch (error) {
        logger.error(
          `[MessageService] Failed to send via Evolution API: ${(error as Error).message}`,
        );
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        sender: data.sender as any,
        content: data.content,
        externalId: externalId || undefined,
      },
    });

    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    logger.info(
      `Message sent in conversation ${data.conversationId} by ${data.sender}${externalId ? ` (ext: ${externalId})` : ""}`,
    );

    return message;
  }

  async findByConversation(
    conversationId: string,
    companyId: string,
    userId: string,
    role: string,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    if (role === "EMPLOYEE" && conversation.assignedToId !== userId) {
      throw new AppError("Access denied to this conversation", 403);
    }

    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendWhatsAppMessage(
    companyId: string,
    phone: string,
    content: string,
  ): Promise<boolean> {
    try {
      await evolutionService.sendMessage(companyId, phone, content);
      return true;
    } catch (error) {
      logger.error(
        `[WhatsApp] Failed to send to ${phone}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
