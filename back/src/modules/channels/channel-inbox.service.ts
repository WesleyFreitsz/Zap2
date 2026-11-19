import { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env";
import prisma from "../../config/prisma";
import { emitMessageCreated } from "../../realtime";
import { decryptSecret } from "../../utils/crypto";
import { graphRequest } from "../meta/meta-graph.client";
import type { InboundMessage } from "../meta/meta-webhook";
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

  try {
    const updated = await prisma.$transaction(async (tx) => {
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

      await tx.message.create({
        data: { conversationId: conversation.id, externalId, content, sender: "CLIENT", createdAt: sentAt },
      });
      return tx.conversation.update({ where: { id: conversation.id, companyId }, data: { updatedAt: new Date() } });
    });
    if (updated) emitMessageCreated(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
      await prisma.message.findUnique({ where: { externalId }, select: { id: true } })) return;
    throw error;
  }
}
