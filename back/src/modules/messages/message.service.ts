import prisma from "../../config/prisma";
import { emitMessageCreated } from "../../realtime";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { wppConnectService } from "../integrations/wppconnect/wppconnect.service";
import { SendMessageInput } from "./message.schema";

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
    const destination =
      conversation.contactRemoteId || conversation.contactPhone;

    if (conversation.channel === "WHATSAPP") {
      try {
        const result = await wppConnectService.sendMessageAuto(
          companyId,
          destination,
          data.content,
        );
        externalId = result.externalId;
      } catch (error) {
        logger.error(
          `[MessageService] Failed to send via WPPConnect: ${(error as Error).message}`,
        );
        throw new AppError("Failed to send WhatsApp message", 500);
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        sender: "USER",
        content: data.content,
        externalId: externalId || undefined,
      },
    });

    const updated = await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });
    emitMessageCreated(updated);

    logger.info(
      `Message sent in conversation ${data.conversationId} by ${userId}${externalId ? ` (ext: ${externalId})` : ""}`,
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
      await wppConnectService.sendMessageAuto(companyId, phone, content);
      return true;
    } catch (error) {
      logger.error(
        `[WhatsApp] Failed to send to ${phone}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
