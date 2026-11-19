import { assertConversationAccess } from "../conversations/conversation-access";
import prisma from "../../config/prisma";
import { emitMessageCreated } from "../../realtime";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { wppConnectService } from "../integrations/wppconnect/wppconnect.service";
import { prepareTemplate, sendTemplate, sendText } from "../channels/channel-sender";
import { AiConfigService } from "../ai-config/aiConfig.service";
import { createChatCompletion } from "../ai-config/groq.client";
import { SendMessageInput, SendTemplateInput, SuggestReplyInput } from "./message.schema";
import { buildReplySuggestionPrompt } from "./reply-suggestion.prompt";

const aiConfigService = new AiConfigService();
const SUGGESTION_HISTORY = 12;
const SUGGESTION_CATALOG_LIMIT = 50;

export class MessageService {
  async send(
    data: SendMessageInput,
    companyId: string,
    userId: string,
    role: string,
  ) {
    const conversation = await this.findConversationForSend(data.conversationId, companyId, userId, role);
    const { externalId } = await sendText(conversation, data.content);
    return this.recordSentMessage(conversation.id, companyId, userId, data.content, externalId);
  }

  async sendTemplate(data: SendTemplateInput, companyId: string, userId: string, role: string) {
    const conversation = await this.findConversationForSend(data.conversationId, companyId, userId, role);
    const { payload, content } = await prepareTemplate(conversation, {
      name: data.templateName,
      language: data.language,
      parameters: data.parameters,
    });
    const { externalId } = await sendTemplate(conversation, payload);
    return this.recordSentMessage(conversation.id, companyId, userId, content, externalId);
  }

  private async findConversationForSend(conversationId: string, companyId: string, userId: string, role: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    assertConversationAccess(conversation, { userId, role });
    return conversation;
  }

  private async recordSentMessage(conversationId: string, companyId: string, userId: string, content: string, externalId: string | null) {
    const [message, updated] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, sender: "USER", content, externalId: externalId || undefined },
      }),
      prisma.conversation.update({
        where: { id: conversationId, companyId },
        data: { updatedAt: new Date() },
      }),
    ]);
    emitMessageCreated(updated);

    logger.info(
      `Message sent in conversation ${conversationId} by ${userId}${externalId ? ` (ext: ${externalId})` : ""}`,
    );

    return message;
  }

  async suggestReply(
    data: SuggestReplyInput,
    companyId: string,
    userId: string,
    role: string,
  ): Promise<{ suggestion: string }> {
    const conversation = await prisma.conversation.findFirst({
      where: { id: data.conversationId, companyId },
      include: { company: { select: { name: true } } },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    assertConversationAccess(conversation, { userId, role });

    const [recentMessages, aiConfig, products] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: SUGGESTION_HISTORY,
        select: { sender: true, content: true },
      }),
      aiConfigService.get(companyId),
      prisma.product.findMany({
        where: { companyId, active: true },
        orderBy: { name: "asc" },
        take: SUGGESTION_CATALOG_LIMIT,
        select: {
          name: true,
          code: true,
          description: true,
          price: true,
          promotionalPrice: true,
          stock: true,
        },
      }),
    ]);

    if (recentMessages.length === 0) {
      throw new AppError("Conversa sem mensagens para sugerir resposta", 400);
    }

    const prompt = buildReplySuggestionPrompt({
      companyName: conversation.company.name,
      personality: aiConfig.personality,
      language: aiConfig.language,
      systemPrompt: aiConfig.systemPrompt,
      productContext: aiConfig.productContext,
      products,
      messages: recentMessages.reverse(),
    });

    const suggestion = await createChatCompletion(prompt, {
      // modelos de raciocínio gastam parte do limite antes de escrever a resposta
      maxTokens: Math.max(aiConfig.maxTokens, 600),
      temperature: aiConfig.temperature,
    });

    return { suggestion };
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

    assertConversationAccess(conversation, { userId, role });

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
