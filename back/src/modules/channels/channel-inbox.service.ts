import { rm } from "node:fs/promises";
import { Prisma, type MessageStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env";
import prisma from "../../config/prisma";
import { emitMessageCreated, emitMessageUpdated } from "../../realtime";
import { decryptSecret } from "../../utils/crypto";
import { logger } from "../../utils/logger";
import { saveMediaBuffer } from "../../utils/media";
import { graphRequest } from "../meta/meta-graph.client";
import { downloadInboundMedia } from "../meta/meta-media";
import type { InboundMedia, InboundMessage, MessageEvent } from "../meta/meta-webhook";
import { UserService } from "../users/user.service";

const userService = new UserService();
const profileSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  name: z.string().optional(),
  username: z.string().optional(),
});

async function findContactName(
  { channel, contactRemoteId }: InboundMessage,
  accessTokenEncrypted: string | null,
): Promise<string | undefined> {
  if (channel === "WHATSAPP" || !accessTokenEncrypted) return;
  try {
    const token = decryptSecret(accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
    const result = profileSchema.safeParse(await graphRequest(encodeURIComponent(contactRemoteId), {
      token,
      query: { fields: channel === "FACEBOOK" ? "first_name,last_name" : "name,username" },
    }));
    if (result.success) {
      const { first_name, last_name, name, username } = result.data;
      return channel === "FACEBOOK" ? [first_name, last_name].filter(Boolean).join(" ") : name || username;
    }
  } catch {
    return;
  }
}

async function saveInboundMedia(media: InboundMedia, accessTokenEncrypted: string | null) {
  try {
    const token = media.source.type === "whatsapp_media_id" && accessTokenEncrypted
      ? decryptSecret(accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY)
      : undefined;
    const { buffer, mimeType, fileName } = await downloadInboundMedia(media, token);
    const saved = await saveMediaBuffer({
      buffer,
      directory: "chat-media",
      mimeType: mimeType === "image/svg+xml" ? "application/octet-stream" : mimeType,
    });
    return {
      absolutePath: saved.absolutePath,
      fields: {
        mediaType: media.kind,
        mediaUrl: saved.url,
        mimeType,
        fileName: fileName ?? saved.fileName,
        fileSize: saved.size,
      },
    };
  } catch {
    logger.warn("[Meta] Falha ao salvar a mídia recebida", { kind: media.kind, source: media.source.type });
  }
}

async function removeUnusedMedia(absolutePath?: string) {
  if (!absolutePath) return;
  try {
    await rm(absolutePath, { force: true });
  } catch {
    logger.warn("[Meta] Falha ao remover mídia sem mensagem");
  }
}

export async function ingestInbound(inbound: InboundMessage): Promise<void> {
  const { channel, accountId, contactRemoteId, externalId, sentAt, content } = inbound;
  const integration = await prisma.integration.findFirst({
    where: { type: channel, externalAccountId: accountId, provider: "META", status: "ACTIVE" },
    select: { id: true, companyId: true, accessTokenEncrypted: true },
  });
  if (!integration) return;

  const { id: integrationId, companyId } = integration;
  const conversationWhere = { companyId, channel, contactRemoteId, integrationId, status: { not: "CLOSED" as const } };
  const [duplicate, existing] = await Promise.all([
    prisma.message.findUnique({ where: { externalId }, select: { id: true } }),
    prisma.conversation.findFirst({ where: conversationWhere, select: { id: true } }),
  ]);
  if (duplicate) return;
  let contactName = inbound.contactName;
  let assignedToId: string | undefined;
  if (!existing) {
    contactName ||= await findContactName(inbound, integration.accessTokenEncrypted);
    assignedToId = await userService.getNextEmployeeRoundRobin(companyId);
  }
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const active = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM integrations
        WHERE id = ${integrationId} AND "companyId" = ${companyId} AND status = 'ACTIVE'
        FOR NO KEY UPDATE
      `;
      if (!active.length || await tx.message.findUnique({ where: { externalId }, select: { id: true } })) return;

      let conversation = await tx.conversation.findFirst({ where: conversationWhere });
      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            companyId,
            integrationId,
            channel,
            contactRemoteId,
            contactName: contactName || contactRemoteId,
            contactPhone: contactRemoteId,
            assignedToId,
          },
        });
      }

      const message = await tx.message.create({
        data: { conversationId: conversation.id, externalId, content, sender: "CLIENT", createdAt: sentAt },
        select: { id: true },
      });
      const touched = await tx.conversation.update({ where: { id: conversation.id, companyId }, data: { updatedAt: new Date() } });
      return { conversation: touched, messageId: message.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
      await prisma.message.findUnique({ where: { externalId }, select: { id: true } })) {
      return;
    }
    throw error;
  }
  if (!updated) return;
  emitMessageCreated(updated.conversation);
  if (inbound.media) {
    void attachInboundMedia(updated.messageId, updated.conversation, inbound.media, integration.accessTokenEncrypted);
  }
}

const statusTransitions: Record<MessageStatus, Prisma.MessageWhereInput> = {
  SENT: { status: null },
  DELIVERED: { OR: [{ status: null }, { status: { in: ["SENT", "FAILED"] } }] },
  READ: { OR: [{ status: null }, { status: { not: "READ" } }] },
  FAILED: { status: "SENT" },
};

export async function applyMessageEvent(event: MessageEvent): Promise<void> {
  const conversationWhere: Prisma.ConversationWhereInput = {
    channel: event.channel,
    integration: { type: event.channel, externalAccountId: event.accountId, provider: "META", status: "ACTIVE" },
  };
  let messageWhere: Prisma.MessageWhereInput;
  let data: Prisma.MessageUpdateManyMutationInput;
  if (event.kind === "read") {
    conversationWhere.contactRemoteId = event.contactRemoteId;
    messageWhere = { sender: "USER", createdAt: { lte: event.watermark }, ...statusTransitions.READ };
    data = { status: "READ" };
  } else if (event.kind === "status") {
    messageWhere = { externalId: event.externalId, ...statusTransitions[event.status] };
    data = { status: event.status };
  } else {
    messageWhere = {
      externalId: event.externalId,
      OR: event.emoji === null ? [{ reaction: { not: null } }] : [{ reaction: null }, { reaction: { not: event.emoji } }],
    };
    data = { reaction: event.emoji };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const conversations = await tx.conversation.findMany({
      where: { ...conversationWhere, messages: { some: messageWhere } },
      select: { id: true, companyId: true, assignedToId: true },
      orderBy: { id: "asc" },
    });
    const changed: typeof conversations = [];
    for (const conversation of conversations) {
      const { count } = await tx.message.updateMany({
        where: { ...messageWhere, conversationId: conversation.id, conversation: conversationWhere },
        data,
      });
      if (count > 0) changed.push(conversation);
    }
    return changed;
  });
  for (const conversation of updated) emitMessageUpdated(conversation);
}

async function attachInboundMedia(
  messageId: string,
  conversation: Parameters<typeof emitMessageUpdated>[0],
  inboundMedia: InboundMedia,
  accessTokenEncrypted: string | null,
) {
  const media = await saveInboundMedia(inboundMedia, accessTokenEncrypted);
  if (!media) return;
  try {
    await prisma.message.update({ where: { id: messageId }, data: media.fields });
    emitMessageUpdated(conversation);
  } catch {
    await removeUnusedMedia(media.absolutePath);
  }
}
