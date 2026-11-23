import { assertConversationAccess } from "../conversations/conversation-access";
import prisma from "../../config/prisma";
import { emitMessageCreated, emitMessageUpdated } from "../../realtime";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { saveMediaBuffer } from "../../utils/media";
import { wppConnectService, type SendMediaOptions } from "../integrations/wppconnect/wppconnect.service";
import {
  deleteMessage,
  editMessage,
  prepareTemplate,
  reactToMessage,
  sendMediaFile,
  sendTemplate,
  sendText,
} from "../channels/channel-sender";
import { AiConfigService } from "../ai-config/aiConfig.service";
import { createChatCompletion } from "../ai-config/groq.client";
import {
  EditMessageInput,
  ReactMessageInput,
  SendMediaInput,
  SendMessageInput,
  SendTemplateInput,
  SuggestReplyInput,
} from "./message.schema";
import { canEditMessage, presentMessage, replyToSelect } from "./message-rules";
import { buildReplySuggestionPrompt } from "./reply-suggestion.prompt";

const aiConfigService = new AiConfigService();
const SUGGESTION_HISTORY = 12;
const SUGGESTION_CATALOG_LIMIT = 50;

type SentMessageData = {
  content: string;
  externalId: string | null;
  replyToId?: string;
  media?: { mediaType: string; mediaUrl: string; mimeType: string; fileName: string; fileSize: number };
};

function getMediaType(mimeType: string): SendMediaOptions["type"] {
  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export class MessageService {
  async send(
    data: SendMessageInput,
    companyId: string,
    userId: string,
    role: string,
  ) {
    const conversation = await this.findConversationForSend(data.conversationId, companyId, userId, role);
    const replyTo = await this.findReplyTarget(conversation.id, data.replyToId);
    const { externalId } = await sendText(conversation, data.content, replyTo?.externalId);
    return this.recordSentMessage(conversation.id, companyId, userId, {
      content: data.content,
      externalId,
      replyToId: replyTo?.id,
    });
  }

  async sendMedia(
    data: SendMediaInput,
    file: Express.Multer.File,
    companyId: string,
    userId: string,
    role: string,
  ) {
    const conversation = await this.findConversationForSend(data.conversationId, companyId, userId, role);
    const replyTo = await this.findReplyTarget(conversation.id, data.replyToId);
    const mimeType = file.mimetype.split(";")[0].trim().toLowerCase();
    const fileType = getMediaType(mimeType);
    if (data.asSticker && fileType !== "image") throw new AppError("Figurinha precisa ser uma imagem", 415);
    const mediaType = data.asSticker ? "sticker" : fileType;
    const fileName = file.originalname || mediaType;

    const { externalId } = await sendMediaFile(conversation, {
      type: mediaType,
      base64: file.buffer.toString("base64"),
      mimeType,
      fileName,
      caption: data.caption,
      quotedMsg: replyTo?.externalId || undefined,
    });
    const saved = await saveMediaBuffer({
      buffer: file.buffer,
      directory: `chat-media/${companyId}`,
      fileName,
      mimeType,
    });

    return this.recordSentMessage(conversation.id, companyId, userId, {
      content: mediaType === "sticker" ? "" : data.caption || (mediaType === "document" ? fileName : ""),
      externalId,
      replyToId: replyTo?.id,
      media: { mediaType, mediaUrl: saved.url, mimeType, fileName, fileSize: saved.size },
    });
  }

  async react(messageId: string, data: ReactMessageInput, companyId: string, userId: string, role: string) {
    const { message, conversation } = await this.findMessageForAction(messageId, companyId, userId, role);
    if (message.deletedAt) throw new AppError("Mensagem apagada", 422);
    await reactToMessage(conversation, this.requireExternalId(message.externalId), data.emoji);
    await prisma.message.update({ where: { id: message.id }, data: { ownReaction: data.emoji } });
    emitMessageUpdated(conversation);
  }

  async edit(messageId: string, data: EditMessageInput, companyId: string, userId: string, role: string) {
    const { message, conversation } = await this.findMessageForAction(messageId, companyId, userId, role);
    if (!canEditMessage(message)) {
      throw new AppError("Só é possível editar mensagens enviadas há até 15 minutos", 422);
    }
    await editMessage(conversation, this.requireExternalId(message.externalId), data.content);

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { content: data.content, editedAt: new Date() },
      include: { replyTo: replyToSelect },
    });
    emitMessageUpdated(conversation);
    return presentMessage(updated);
  }

  async remove(messageId: string, companyId: string, userId: string, role: string) {
    const { message, conversation } = await this.findMessageForAction(messageId, companyId, userId, role);
    if (message.sender !== "USER") throw new AppError("Só é possível apagar mensagens enviadas", 422);
    if (message.deletedAt) return;
    await deleteMessage(conversation, this.requireExternalId(message.externalId));

    await prisma.message.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
    emitMessageUpdated(conversation);
  }

  private async findMessageForAction(messageId: string, companyId: string, userId: string, role: string) {
    const found = await prisma.message.findFirst({
      where: { id: messageId, conversation: { companyId } },
      include: { conversation: true },
    });
    if (!found) throw new AppError("Message not found", 404);

    const { conversation, ...message } = found;
    assertConversationAccess(conversation, { userId, role });
    return { message, conversation };
  }

  private requireExternalId(externalId: string | null): string {
    if (!externalId) throw new AppError("Mensagem sem identificador no canal", 422);
    return externalId;
  }

  private async findReplyTarget(conversationId: string, replyToId?: string) {
    if (!replyToId) return null;
    const replyTo = await prisma.message.findFirst({
      where: { id: replyToId, conversationId },
      select: { id: true, externalId: true },
    });
    if (!replyTo) throw new AppError("Mensagem citada não encontrada", 404);
    return replyTo;
  }

  async listStickers(companyId: string) {
    return wppConnectService.listSavedStickers(companyId);
  }

  async sendTemplate(data: SendTemplateInput, companyId: string, userId: string, role: string) {
    const conversation = await this.findConversationForSend(data.conversationId, companyId, userId, role);
    const { payload, content } = await prepareTemplate(conversation, {
      name: data.templateName,
      language: data.language,
      parameters: data.parameters,
    });
    const { externalId } = await sendTemplate(conversation, payload);
    return this.recordSentMessage(conversation.id, companyId, userId, { content, externalId });
  }

  async sendFromIntegration(conversationId: string, companyId: string, content: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, companyId } });
    if (!conversation) throw new AppError("Conversation not found", 404);
    const { externalId } = await sendText(conversation, content);
    return this.recordSentMessage(conversation.id, companyId, "integration", { content, externalId });
  }

  private async findConversationForSend(conversationId: string, companyId: string, userId: string, role: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });

    if (!conversation) throw new AppError("Conversation not found", 404);

    assertConversationAccess(conversation, { userId, role });
    return conversation;
  }

  private async recordSentMessage(
    conversationId: string,
    companyId: string,
    userId: string,
    { content, externalId, replyToId, media }: SentMessageData,
  ) {
    const [message, updated] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          sender: "USER",
          content,
          externalId: externalId || undefined,
          status: externalId ? "SENT" : undefined,
          replyToId,
          ...media,
        },
        include: { replyTo: replyToSelect },
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

    return presentMessage(message);
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

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      include: { replyTo: replyToSelect },
    });
    return messages.map(presentMessage);
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
