import prisma from "../../config/prisma";
import { logger } from "../../utils/logger";
import { appendClientMessage } from "../zendesk/zendesk.service";
import { publishEvent } from "./automation.service";

export async function notifyClientMessage(messageId: string): Promise<void> {
  try {
    const message = await prisma.message.findUnique({ where: { id: messageId }, include: { conversation: true } });
    if (!message) return;
    const { conversation } = message;
    await Promise.all([
      publishEvent(conversation.companyId, "message.received", {
        messageId: message.id,
        conversationId: conversation.id,
        channel: conversation.channel,
        contact: {
          name: conversation.contactName,
          phone: conversation.contactPhone,
          remoteId: conversation.contactRemoteId,
        },
        content: message.content,
        mediaType: message.mediaType,
        mediaUrl: message.mediaUrl,
        createdAt: message.createdAt,
      }),
      appendClientMessage(conversation, message),
    ]);
  } catch (error) {
    logger.warn("[Automations] Falha ao notificar mensagem recebida", { messageId, error: String(error) });
  }
}
