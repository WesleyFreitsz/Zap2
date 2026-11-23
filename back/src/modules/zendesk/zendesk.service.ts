import type { Conversation, Message } from "@prisma/client";
import { env } from "../../config/env";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { decryptSecret, encryptSecret } from "../../utils/crypto";
import { logger } from "../../utils/logger";
import { generateSecretToken, hashSecretToken } from "../../utils/secret-token";
import { assertConversationAccess, type Actor } from "../conversations/conversation-access";
import { zendeskRequest, type ZendeskComment, type ZendeskCredentials } from "./zendesk.client";
import type { SaveZendeskConfigInput } from "./zendesk.schema";

const TRANSCRIPT_LIMIT = 50;
const senderLabels: Record<Message["sender"], string> = { CLIENT: "Cliente", USER: "Atendente", SYSTEM: "Sistema" };
const channelLabels: Record<Conversation["channel"], string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Messenger",
};

type TranscriptMessage = Pick<Message, "sender" | "content" | "mediaUrl" | "createdAt">;

function describeMessage({ content, mediaUrl }: Pick<Message, "content" | "mediaUrl">): string {
  const media = mediaUrl ? `[mídia: ${mediaUrl.startsWith("/") ? `${env.FRONTEND_URL}${mediaUrl}` : mediaUrl}]` : "";
  return [content, media].filter(Boolean).join("\n") || "[mensagem sem texto]";
}

export function formatTranscript(messages: TranscriptMessage[]): string {
  return messages
    .map((message) => {
      const time = message.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      return `[${time}] ${senderLabels[message.sender]}: ${describeMessage(message)}`;
    })
    .join("\n");
}

export function selectPendingAgentComments(
  comments: ZendeskComment[],
  agentIds: Set<number>,
  lastCommentId: string | null,
): ZendeskComment[] {
  return comments
    .filter((comment) => comment.public && agentIds.has(comment.author_id))
    .filter((comment) => lastCommentId === null || BigInt(comment.id) > BigInt(lastCommentId))
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
}

async function loadCredentials(companyId: string): Promise<ZendeskCredentials | null> {
  const config = await prisma.zendeskConfig.findUnique({ where: { companyId } });
  if (!config) return null;
  return {
    subdomain: config.subdomain,
    email: config.email,
    apiToken: decryptSecret(config.apiTokenEncrypted, env.TOKEN_ENCRYPTION_KEY),
  };
}

const clearTicketLink = { zendeskTicketId: null, zendeskRequesterId: null, zendeskLastCommentId: null };

async function isTicketClosed(credentials: ZendeskCredentials, ticketId: string): Promise<boolean> {
  try {
    const { ticket } = await zendeskRequest<{ ticket: { status: string } }>(credentials, `/tickets/${ticketId}.json`);
    return ticket.status === "closed";
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) return true;
    throw error;
  }
}

function ticketUrl(subdomain: string, ticketId: string) {
  return `https://${subdomain}.zendesk.com/agent/tickets/${ticketId}`;
}

export async function appendClientMessage(
  conversation: Pick<Conversation, "companyId" | "zendeskTicketId" | "zendeskRequesterId">,
  message: Pick<Message, "content" | "mediaUrl">,
): Promise<void> {
  const { companyId, zendeskTicketId, zendeskRequesterId } = conversation;
  if (!zendeskTicketId || !zendeskRequesterId) return;
  const credentials = await loadCredentials(companyId).catch(() => null);
  if (!credentials) return;
  try {
    await zendeskRequest(credentials, `/tickets/${zendeskTicketId}.json`, {
      method: "PUT",
      body: { ticket: { comment: { body: describeMessage(message), public: true, author_id: Number(zendeskRequesterId) } } },
    });
  } catch (error) {
    logger.warn("[Zendesk] Falha ao enviar mensagem do cliente ao ticket", { companyId, zendeskTicketId, error: String(error) });
    if (await isTicketClosed(credentials, zendeskTicketId).catch(() => false)) {
      await prisma.conversation.updateMany({ where: { companyId, zendeskTicketId }, data: clearTicketLink });
    }
  }
}

export class ZendeskService {
  async getConfig(companyId: string) {
    const config = await prisma.zendeskConfig.findUnique({ where: { companyId } });
    return {
      connected: Boolean(config),
      subdomain: config?.subdomain ?? null,
      email: config?.email ?? null,
      hasWebhookToken: Boolean(config?.webhookTokenHash),
    };
  }

  async saveConfig(companyId: string, { subdomain, email, apiToken }: SaveZendeskConfigInput) {
    const { user } = await zendeskRequest<{ user: { id: number | null; role: string } }>(
      { subdomain, email, apiToken },
      "/users/me.json",
    );
    if (!user.id || !["admin", "agent"].includes(user.role)) {
      throw new AppError("Use o e-mail e o token de um agente do Zendesk", 422);
    }
    const apiTokenEncrypted = encryptSecret(apiToken, env.TOKEN_ENCRYPTION_KEY);
    const previous = await prisma.zendeskConfig.findUnique({ where: { companyId }, select: { subdomain: true } });
    await prisma.$transaction([
      prisma.zendeskConfig.upsert({
        where: { companyId },
        create: { companyId, subdomain, email, apiTokenEncrypted },
        update: { subdomain, email, apiTokenEncrypted },
      }),
      ...(previous && previous.subdomain !== subdomain
        ? [prisma.conversation.updateMany({ where: { companyId, zendeskTicketId: { not: null } }, data: clearTicketLink })]
        : []),
    ]);
    return this.getConfig(companyId);
  }

  async removeConfig(companyId: string) {
    await prisma.$transaction([
      prisma.zendeskConfig.deleteMany({ where: { companyId } }),
      prisma.conversation.updateMany({ where: { companyId, zendeskTicketId: { not: null } }, data: clearTicketLink }),
    ]);
    return this.getConfig(companyId);
  }

  async rotateWebhookToken(companyId: string) {
    const token = generateSecretToken("zdk");
    const { count } = await prisma.zendeskConfig.updateMany({
      where: { companyId },
      data: { webhookTokenHash: hashSecretToken(token) },
    });
    if (count === 0) throw new AppError("Conecte o Zendesk antes de gerar o token", 422);
    return { token };
  }

  async createTicket(conversationId: string, companyId: string, actor: Actor) {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, companyId } });
    if (!conversation) throw new AppError("Conversation not found", 404);
    assertConversationAccess(conversation, actor);

    const credentials = await loadCredentials(companyId);
    if (!credentials) throw new AppError("O Zendesk não está conectado", 422);
    if (conversation.zendeskTicketId && !(await isTicketClosed(credentials, conversation.zendeskTicketId))) {
      return { ticketId: conversation.zendeskTicketId, ticketUrl: ticketUrl(credentials.subdomain, conversation.zendeskTicketId) };
    }

    const contactId = conversation.contactRemoteId || conversation.contactPhone;
    const [me, requester, messages] = await Promise.all([
      zendeskRequest<{ user: { id: number } }>(credentials, "/users/me.json"),
      zendeskRequest<{ user: { id: number } }>(credentials, "/users/create_or_update.json", {
        method: "POST",
        body: { user: { name: conversation.contactName, external_id: `zap2:${conversation.channel}:${contactId}` } },
      }),
      prisma.message.findMany({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: TRANSCRIPT_LIMIT,
        select: { sender: true, content: true, mediaUrl: true, createdAt: true },
      }),
    ]);
    const channel = channelLabels[conversation.channel];
    const header = `Conversa do ${channel} com ${conversation.contactName} (${conversation.contactPhone}).`;
    const { ticket } = await zendeskRequest<{ ticket: { id: number } }>(credentials, "/tickets.json", {
      method: "POST",
      body: {
        ticket: {
          subject: `${channel}: ${conversation.contactName}`,
          requester_id: requester.user.id,
          external_id: conversation.id,
          tags: ["zap2", conversation.channel.toLowerCase()],
          comment: {
            body: `${header}\n\n${formatTranscript(messages.reverse())}`,
            public: false,
            author_id: me.user.id,
          },
        },
      },
    });

    const ticketId = String(ticket.id);
    const { count } = await prisma.conversation.updateMany({
      where: { id: conversationId, companyId, zendeskTicketId: conversation.zendeskTicketId },
      data: { zendeskTicketId: ticketId, zendeskRequesterId: String(requester.user.id), zendeskLastCommentId: null },
    });
    if (count === 0) {
      const winner = await prisma.conversation.findFirst({ where: { id: conversationId, companyId }, select: { zendeskTicketId: true } });
      if (winner?.zendeskTicketId) {
        return { ticketId: winner.zendeskTicketId, ticketUrl: ticketUrl(credentials.subdomain, winner.zendeskTicketId) };
      }
    }
    return { ticketId, ticketUrl: ticketUrl(credentials.subdomain, ticketId) };
  }

  async handleWebhook(token: string | undefined, ticketId: string) {
    const config = token
      ? await prisma.zendeskConfig.findUnique({ where: { webhookTokenHash: hashSecretToken(token) }, select: { companyId: true } })
      : null;
    if (!config) throw new AppError("Token do webhook inválido", 401);
    const { companyId } = config;

    const conversation = await prisma.conversation.findFirst({ where: { companyId, zendeskTicketId: ticketId } });
    if (!conversation?.zendeskRequesterId) return { delivered: 0 };
    const credentials = await loadCredentials(companyId);
    if (!credentials) return { delivered: 0 };

    const { comments, users } = await zendeskRequest<{ comments: ZendeskComment[]; users: Array<{ id: number; role: string }> }>(
      credentials,
      `/tickets/${ticketId}/comments.json?sort_order=desc&include=users`,
    );
    const agentIds = new Set(users.filter((user) => user.role === "agent" || user.role === "admin").map((user) => user.id));
    const pending = selectPendingAgentComments(comments, agentIds, conversation.zendeskLastCommentId);
    if (pending.length === 0) return { delivered: 0 };

    const { MessageService } = await import("../messages/message.service");
    const messageService = new MessageService();
    let cursor = conversation.zendeskLastCommentId;
    let delivered = 0;
    for (const comment of pending) {
      const commentId = String(comment.id);
      const claimed = await prisma.conversation.updateMany({
        where: { id: conversation.id, zendeskTicketId: ticketId, zendeskLastCommentId: cursor },
        data: { zendeskLastCommentId: commentId },
      });
      if (claimed.count === 0) {
        const fresh = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          select: { zendeskTicketId: true, zendeskLastCommentId: true },
        });
        if (fresh?.zendeskTicketId !== ticketId) break;
        cursor = fresh.zendeskLastCommentId;
        if (cursor !== null && BigInt(comment.id) <= BigInt(cursor)) continue;
        break;
      }
      cursor = commentId;
      try {
        await messageService.sendFromIntegration(conversation.id, companyId, comment.plain_body);
        delivered++;
      } catch (error) {
        logger.warn("[Zendesk] Falha ao entregar resposta ao cliente", { companyId, ticketId, error: String(error) });
        const reason = error instanceof AppError ? error.message : "erro inesperado";
        await zendeskRequest(credentials, `/tickets/${ticketId}.json`, {
          method: "PUT",
          body: { ticket: { comment: { body: `O Zap2 não conseguiu entregar esta resposta ao cliente (${reason}).`, public: false } } },
        }).catch(() => undefined);
      }
    }
    return { delivered };
  }
}
