import type { Conversation } from "@prisma/client";
import { z } from "zod";
import prisma from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { decryptSecret } from "../../utils/crypto";
import { logger } from "../../utils/logger";
import { wppConnectService, type SendMediaOptions } from "../integrations/wppconnect/wppconnect.service";
import { graphRequest, listWhatsAppTemplates } from "../meta/meta-graph.client";
import {
  buildTemplatePayload,
  renderTemplateBody,
  type TemplateInput,
  type TemplatePayload,
  type TemplateSummary,
} from "../meta/whatsapp-templates";

const whatsappResponse = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).nonempty() });
const pageResponse = z.object({ message_id: z.string().min(1) });
const metaImageUrl = z.string().url().regex(/^https:\/\/[^/\\\s]/i);
const templateCacheTtl = 5 * 60 * 1000;
const templateCache = new Map<string, { wabaId: string; updatedAt: number; expiresAt: number; templates: TemplateSummary[] }>();

function findMetaIntegration(companyId: string, integrationId: string, channel: Conversation["channel"]) {
  return prisma.integration.findFirst({
    where: { id: integrationId, companyId, type: channel, provider: "META" },
    select: { status: true, externalAccountId: true, accessTokenEncrypted: true, wabaId: true, updatedAt: true },
  });
}

function readMetaToken(accessTokenEncrypted: string | null) {
  if (!accessTokenEncrypted) throw new AppError("Integração Meta não configurada", 503);
  return decryptSecret(accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
}

async function getMetaSender(conversation: Conversation) {
  const { companyId, channel, integrationId } = conversation;
  const integration = integrationId ? await findMetaIntegration(companyId, integrationId, channel) : null;
  if (!integration) return null;

  if (integration.status !== "ACTIVE") throw new AppError("Canal sem integração ativa", 422);
  if (!integration.externalAccountId) throw new AppError("Integração Meta não configurada", 503);
  return { accountId: integration.externalAccountId, token: readMetaToken(integration.accessTokenEncrypted) };
}

export async function getWhatsAppTemplates(companyId: string, integrationId: string, refresh = false) {
  const integration = await findMetaIntegration(companyId, integrationId, "WHATSAPP");
  if (!integration?.wabaId) throw new AppError("Canal sem suporte a templates", 422);

  const { wabaId } = integration;
  const updatedAt = integration.updatedAt.getTime();
  const cached = templateCache.get(integrationId);
  if (!refresh && cached?.wabaId === wabaId && cached.updatedAt === updatedAt && cached.expiresAt > Date.now()) {
    return cached.templates;
  }

  const templates = await listWhatsAppTemplates(wabaId, readMetaToken(integration.accessTokenEncrypted));
  const entry = { wabaId, updatedAt, expiresAt: Date.now() + templateCacheTtl, templates };
  templateCache.set(integrationId, entry);
  setTimeout(() => {
    if (templateCache.get(integrationId) === entry) templateCache.delete(integrationId);
  }, templateCacheTtl).unref();
  return templates;
}

export async function prepareTemplate(conversation: Conversation, input: TemplateInput, refresh = false) {
  if (conversation.channel !== "WHATSAPP" || !conversation.integrationId) {
    throw new AppError("Canal sem suporte a templates", 422);
  }
  const templates = await getWhatsAppTemplates(conversation.companyId, conversation.integrationId, refresh);
  const summary = templates.find(({ name, language }) => name === input.name && language === input.language);
  if (!summary) throw new AppError("Template indisponível", 422);

  return {
    payload: buildTemplatePayload(summary, input.parameters),
    content: renderTemplateBody(summary, input.parameters),
  };
}

async function sendWhatsApp(
  conversation: Conversation,
  { accountId, token }: NonNullable<Awaited<ReturnType<typeof getMetaSender>>>,
  message: (
    | { type: "text"; text: { preview_url: boolean; body: string } }
    | { type: "template"; template: TemplatePayload }
    | { type: "image"; image: { link: string; caption: string } }
    | { type: "reaction"; reaction: { message_id: string; emoji: string } }
  ) & { context?: { message_id: string } },
) {
  const response = await graphRequest(`${encodeURIComponent(accountId)}/messages`, {
    token,
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: conversation.contactRemoteId || conversation.contactPhone,
      ...message,
    },
  });
  const result = whatsappResponse.safeParse(response);
  if (!result.success) throw new AppError("Resposta de envio inválida da Meta", 502);
  return { externalId: result.data.messages[0].id };
}

export async function sendTemplate(conversation: Conversation, template: TemplatePayload) {
  const sender = conversation.channel === "WHATSAPP" ? await getMetaSender(conversation) : null;
  if (!sender) throw new AppError("Canal sem suporte a templates", 422);
  return sendWhatsApp(conversation, sender, { type: "template", template });
}

export async function sendText(
  conversation: Conversation,
  text: string,
  replyToExternalId?: string | null,
): Promise<{ externalId: string | null }> {
  const { companyId, channel, contactRemoteId, contactPhone } = conversation;
  const destination = contactRemoteId || contactPhone;
  const sender = await getMetaSender(conversation);

  if (!sender) {
    if (channel !== "WHATSAPP") throw new AppError("Canal sem integração ativa", 422);
    try {
      return await wppConnectService.sendMessageAuto(companyId, destination, text, replyToExternalId || undefined);
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) throw error;
      logger.error("[ChannelSender] Falha no envio pelo WPPConnect", { error });
      throw new AppError("Failed to send WhatsApp message", 500);
    }
  }

  if (channel === "WHATSAPP") {
    return sendWhatsApp(conversation, sender, {
      type: "text",
      text: { preview_url: false, body: text },
      ...(replyToExternalId ? { context: { message_id: replyToExternalId } } : {}),
    });
  }

  return sendPageMessage(destination, sender.token, { text });
}

async function sendPageMessage(
  destination: string,
  token: string,
  message: { text: string } | { attachment: { type: "image"; payload: { url: string; is_reusable: true } } },
) {
  const response = await graphRequest("me/messages", {
    query: { access_token: token },
    body: {
      recipient: { id: destination },
      messaging_type: "RESPONSE",
      message,
    },
  });
  const result = pageResponse.safeParse(response);
  if (!result.success) throw new AppError("Resposta de envio inválida da Meta", 502);
  return { externalId: result.data.message_id };
}

export async function sendImage(conversation: Conversation, { url, caption }: { url: string; caption: string }) {
  const { companyId, channel, contactRemoteId, contactPhone } = conversation;
  const destination = contactRemoteId || contactPhone;
  const sender = await getMetaSender(conversation);

  if (!sender) {
    if (channel !== "WHATSAPP") throw new AppError("Canal sem integração ativa", 422);
    return wppConnectService.sendMediaAuto(companyId, { number: destination, type: "image", url, caption });
  }

  if (!metaImageUrl.safeParse(url).success) {
    throw new AppError("A imagem precisa estar em um endereço público (https) para ser enviada por este canal", 422);
  }

  if (channel === "WHATSAPP") {
    return sendWhatsApp(conversation, sender, { type: "image", image: { link: url, caption } });
  }

  const image = await sendPageMessage(destination, sender.token, {
    attachment: { type: "image", payload: { url, is_reusable: true } },
  });
  if (caption) {
    try {
      await sendPageMessage(destination, sender.token, { text: caption });
    } catch {
      logger.warn("[ChannelSender] Falha no envio da legenda da imagem", { conversationId: conversation.id });
    }
  }
  return image;
}

export async function sendMediaFile(
  conversation: Conversation,
  media: Omit<SendMediaOptions, "number" | "url">,
): Promise<{ externalId: string | null }> {
  const { companyId, channel, contactRemoteId, contactPhone } = conversation;
  if (await getMetaSender(conversation)) throw new AppError("Tipo de mídia não suportado neste canal", 422);
  if (channel !== "WHATSAPP") throw new AppError("Canal sem integração ativa", 422);
  return wppConnectService.sendMediaAuto(companyId, { ...media, number: contactRemoteId || contactPhone });
}

export async function reactToMessage(conversation: Conversation, externalId: string, emoji: string | null) {
  const sender = await getMetaSender(conversation);
  if (conversation.channel !== "WHATSAPP") throw new AppError("Reação não suportada neste canal", 422);
  if (sender) {
    await sendWhatsApp(conversation, sender, {
      type: "reaction",
      reaction: { message_id: externalId, emoji: emoji ?? "" },
    });
    return;
  }
  await wppConnectService.reactToMessage(conversation.companyId, externalId, emoji);
}

async function assertWppConnectChannel(conversation: Conversation, action: string) {
  if (conversation.channel !== "WHATSAPP" || (await getMetaSender(conversation))) {
    throw new AppError(`${action} não suportado neste canal`, 422);
  }
}

export async function editMessage(conversation: Conversation, externalId: string, content: string) {
  await assertWppConnectChannel(conversation, "Editar mensagem");
  await wppConnectService.editMessage(conversation.companyId, externalId, content);
}

export async function deleteMessage(conversation: Conversation, externalId: string) {
  await assertWppConnectChannel(conversation, "Apagar mensagem");
  const { companyId, contactRemoteId, contactPhone } = conversation;
  await wppConnectService.deleteMessage(companyId, contactRemoteId || contactPhone, externalId);
}
