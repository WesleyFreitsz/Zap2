import type { Conversation } from "@prisma/client";
import { z } from "zod";
import prisma from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { decryptSecret } from "../../utils/crypto";
import { logger } from "../../utils/logger";
import { wppConnectService } from "../integrations/wppconnect/wppconnect.service";
import { graphRequest } from "../meta/meta-graph.client";

const whatsappResponse = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).nonempty() });
const pageResponse = z.object({ message_id: z.string().min(1) });

export async function sendText(conversation: Conversation, text: string): Promise<{ externalId: string | null }> {
  const { companyId, channel, integrationId, contactRemoteId, contactPhone } = conversation;
  const destination = contactRemoteId || contactPhone;
  const integration = integrationId ? await prisma.integration.findFirst({
    where: { id: integrationId, companyId, type: channel, provider: "META" },
    select: { status: true, externalAccountId: true, accessTokenEncrypted: true },
  }) : null;

  if (!integration) {
    if (channel !== "WHATSAPP") throw new AppError("Canal sem integração ativa", 422);
    try {
      return await wppConnectService.sendMessageAuto(companyId, destination, text);
    } catch (error) {
      logger.error("[ChannelSender] Falha no envio pelo WPPConnect", { error });
      throw new AppError("Failed to send WhatsApp message", 500);
    }
  }

  if (integration.status !== "ACTIVE") throw new AppError("Canal sem integração ativa", 422);
  if (!integration.externalAccountId || !integration.accessTokenEncrypted) {
    throw new AppError("Integração Meta não configurada", 503);
  }

  const token = decryptSecret(integration.accessTokenEncrypted, env.TOKEN_ENCRYPTION_KEY);
  if (channel === "WHATSAPP") {
    const response = await graphRequest(`${encodeURIComponent(integration.externalAccountId)}/messages`, {
      token,
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: destination,
        type: "text",
        text: { preview_url: false, body: text },
      },
    });
    const result = whatsappResponse.safeParse(response);
    if (result.success) return { externalId: result.data.messages[0].id };
  } else {
    const response = await graphRequest("me/messages", {
      query: { access_token: token },
      body: {
        recipient: { id: destination },
        messaging_type: "RESPONSE",
        message: { text },
      },
    });
    const result = pageResponse.safeParse(response);
    if (result.success) return { externalId: result.data.message_id };
  }
  throw new AppError("Resposta de envio inválida da Meta", 502);
}
