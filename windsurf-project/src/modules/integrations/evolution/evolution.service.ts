import { AxiosError } from "axios";
import { env } from "../../../config/env";
import prisma from "../../../config/prisma";
import { AppError } from "../../../utils/AppError";
import { logger } from "../../../utils/logger";
import { evolutionApi } from "./evolution.http";

interface EvolutionResponse {
  instance?: {
    instanceName?: string;
    instanceId?: string;
    status?: string;
  };
  qrcode?: {
    base64?: string;
  };
  error?: boolean;
  message?: string | string[];
}

export interface SendMediaOptions {
  number: string;
  type: "image" | "video" | "audio" | "document";
  url?: string;
  base64?: string;
  caption?: string;
  fileName?: string;
}

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = `55${digits}`;
  }
  return digits;
}

export class EvolutionService {
  private webhookBaseUrl: string;

  constructor() {
    this.webhookBaseUrl = env.EVOLUTION_WEBHOOK_BASE_URL;
  }

  private async request<T = EvolutionResponse>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await evolutionApi.request<T>({
        method,
        url: path,
        data: body,
      });
      return response.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const axiosErr = error as AxiosError<EvolutionResponse>;
      if (axiosErr.response) {
        const errMsg = axiosErr.response.data?.message;
        const errText = Array.isArray(errMsg)
          ? errMsg.join(", ")
          : errMsg || axiosErr.message;
        throw new AppError(
          `Evolution API error: ${errText}`,
          axiosErr.response.status,
        );
      }
      logger.error(
        `[Evolution API] Request failed: ${(error as Error).message}`,
      );
      throw new AppError("Failed to communicate with Evolution API", 502);
    }
  }

  async createInstance(companyId: string): Promise<{
    instanceName: string;
    instanceId: string;
    qrCode: string | null;
  }> {
    const instanceName = `company-${companyId}`;

    let integration = await prisma.integration.findFirst({
      where: { companyId, type: "WHATSAPP" },
    });

    if (integration?.connectionStatus === "CONNECTED") {
      throw new AppError("WhatsApp already connected for this company", 409);
    }

    const webhookUrl = `${this.webhookBaseUrl}/evolution/${companyId}`;

    const createData = await this.request("POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: true,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      },
    });

    const instanceId =
      createData.instance?.instanceId ||
      createData.instance?.instanceName ||
      instanceName;
    const qrCode = createData.qrcode?.base64 || null;

    if (integration) {
      integration = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          instanceName,
          instanceId,
          webhookUrl,
          qrCode,
          connectionStatus: "CONNECTING",
          status: "ACTIVE",
          token: env.EVOLUTION_API_KEY,
        },
      });
    } else {
      integration = await prisma.integration.create({
        data: {
          type: "WHATSAPP",
          token: env.EVOLUTION_API_KEY,
          companyId,
          status: "ACTIVE",
          instanceName,
          instanceId,
          webhookUrl,
          qrCode,
          connectionStatus: "CONNECTING",
        },
      });
    }

    logger.info(
      `[Evolution] Instance created: ${instanceName} for company ${companyId}`,
    );

    return { instanceName, instanceId, qrCode };
  }

  async getConnectionStatus(companyId: string) {
    const integration = await this.getIntegration(companyId);

    try {
      const data = await this.request<{
        instance: { instanceName: string; state: string };
      }>("GET", `/instance/connectionState/${integration.instanceName}`);

      const state = data.instance?.state || "close";
      const newStatus =
        state === "open"
          ? "CONNECTED"
          : state === "connecting"
            ? "CONNECTING"
            : "DISCONNECTED";

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          connectionStatus: newStatus as any,
          connectedAt:
            newStatus === "CONNECTED" ? new Date() : integration.connectedAt,
        },
      });

      return {
        instanceName: integration.instanceName,
        status: newStatus,
        connectedAt:
          newStatus === "CONNECTED" ? new Date() : integration.connectedAt,
        qrCode: newStatus === "CONNECTING" ? integration.qrCode : null,
      };
    } catch (error) {
      logger.error(
        `[Evolution] Failed to get status for company ${companyId}: ${(error as Error).message}`,
      );

      return {
        instanceName: integration.instanceName,
        status: integration.connectionStatus,
        connectedAt: integration.connectedAt,
        qrCode:
          integration.connectionStatus === "CONNECTING"
            ? integration.qrCode
            : null,
      };
    }
  }

  async getQrCode(companyId: string) {
    const integration = await this.getIntegration(companyId);

    const data = await this.request<{ base64?: string; qrcode?: string }>(
      "GET",
      `/instance/connect/${integration.instanceName}`,
    );

    const qrCode = data.base64 || data.qrcode || null;

    if (qrCode) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { qrCode, connectionStatus: "CONNECTING" },
      });
    }

    return { qrCode, instanceName: integration.instanceName };
  }

  async reconnect(companyId: string) {
    const integration = await this.getIntegration(companyId);

    try {
      await this.request(
        "DELETE",
        `/instance/logout/${integration.instanceName}`,
      );
    } catch {
      logger.warn(
        `[Evolution] Logout failed for ${integration.instanceName}, proceeding with reconnect`,
      );
    }

    const data = await this.request<{ base64?: string; qrcode?: string }>(
      "GET",
      `/instance/connect/${integration.instanceName}`,
    );

    const qrCode = data.base64 || data.qrcode || null;

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        qrCode,
        connectionStatus: "CONNECTING",
        connectedAt: null,
      },
    });

    logger.info(
      `[Evolution] Reconnecting instance: ${integration.instanceName}`,
    );

    return { qrCode, instanceName: integration.instanceName };
  }

  async disconnect(companyId: string) {
    const integration = await this.getIntegration(companyId);

    try {
      await this.request(
        "DELETE",
        `/instance/logout/${integration.instanceName}`,
      );
    } catch {
      logger.warn(
        `[Evolution] Logout request failed for ${integration.instanceName}`,
      );
    }

    try {
      await this.request(
        "DELETE",
        `/instance/delete/${integration.instanceName}`,
      );
    } catch {
      logger.warn(
        `[Evolution] Delete request failed for ${integration.instanceName}`,
      );
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        connectionStatus: "DISCONNECTED",
        qrCode: null,
        connectedAt: null,
      },
    });

    logger.info(
      `[Evolution] Instance disconnected: ${integration.instanceName}`,
    );

    return { message: "WhatsApp disconnected successfully" };
  }

  async sendMessage(
    companyId: string,
    phone: string,
    message: string,
  ): Promise<{ externalId: string | null }> {
    const integration = await this.getIntegration(companyId);

    if (integration.connectionStatus !== "CONNECTED") {
      throw new AppError("WhatsApp is not connected for this company", 400);
    }

    const formattedPhone = normalizePhone(phone);

    const data = await this.request<{ key?: { id?: string } }>(
      "POST",
      `/message/sendText/${integration.instanceName}`,
      {
        number: formattedPhone,
        text: message,
      },
    );

    const externalId = data.key?.id || null;

    logger.info(
      `[Evolution] Message sent to ${formattedPhone} via ${integration.instanceName}, externalId: ${externalId}`,
    );

    return { externalId };
  }

  async sendMedia(
    companyId: string,
    options: SendMediaOptions,
  ): Promise<{ externalId: string | null }> {
    const integration = await this.getIntegration(companyId);

    if (integration.connectionStatus !== "CONNECTED") {
      throw new AppError("WhatsApp is not connected for this company", 400);
    }

    const formattedPhone = normalizePhone(options.number);

    const mediaTypeMap: Record<string, string> = {
      image: "sendMedia",
      video: "sendMedia",
      audio: "sendWhatsAppAudio",
      document: "sendMedia",
    };

    const endpoint = mediaTypeMap[options.type] || "sendMedia";

    const body: Record<string, unknown> = {
      number: formattedPhone,
      mediatype: options.type,
      caption: options.caption || "",
      fileName: options.fileName || "",
    };

    if (options.url) {
      body.media = options.url;
    } else if (options.base64) {
      body.media = options.base64;
    } else {
      throw new AppError(
        "Either url or base64 must be provided for media",
        400,
      );
    }

    const data = await this.request<{ key?: { id?: string } }>(
      "POST",
      `/message/${endpoint}/${integration.instanceName}`,
      body,
    );

    const externalId = data.key?.id || null;

    logger.info(
      `[Evolution] Media (${options.type}) sent to ${formattedPhone} via ${integration.instanceName}, externalId: ${externalId}`,
    );

    return { externalId };
  }

  async checkInstancesOnStartup(): Promise<void> {
    try {
      const integrations = await prisma.integration.findMany({
        where: { type: "WHATSAPP", status: "ACTIVE" },
      });

      for (const integration of integrations) {
        if (!integration.instanceName) continue;

        try {
          const data = await this.request<{
            instance: { state: string };
          }>("GET", `/instance/connectionState/${integration.instanceName}`);

          const state = data.instance?.state || "close";
          const newStatus =
            state === "open"
              ? "CONNECTED"
              : state === "connecting"
                ? "CONNECTING"
                : "DISCONNECTED";

          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              connectionStatus: newStatus as any,
              connectedAt:
                newStatus === "CONNECTED"
                  ? new Date()
                  : integration.connectedAt,
            },
          });

          logger.info(
            `[Evolution Startup] ${integration.instanceName}: ${newStatus}`,
          );
        } catch (err) {
          logger.warn(
            `[Evolution Startup] Could not check ${integration.instanceName}: ${(err as Error).message}`,
          );

          await prisma.integration.update({
            where: { id: integration.id },
            data: { connectionStatus: "DISCONNECTED" },
          });
        }
      }

      logger.info(
        `[Evolution Startup] Checked ${integrations.length} instance(s)`,
      );
    } catch (error) {
      logger.error(
        `[Evolution Startup] Failed to check instances: ${(error as Error).message}`,
      );
    }
  }

  async handleWebhookEvent(
    companyId: string,
    payload: Record<string, unknown>,
  ) {
    const event = payload.event as string;

    logger.info(
      `[Evolution Webhook] Event: ${event} for company: ${companyId}`,
    );

    switch (event) {
      case "connection.update":
        return this.handleConnectionUpdate(companyId, payload);
      case "qrcode.updated":
        return this.handleQrCodeUpdate(companyId, payload);
      case "messages.upsert":
        return this.handleIncomingMessage(companyId, payload);
      default:
        logger.info(`[Evolution Webhook] Unhandled event: ${event}`);
        return { handled: false };
    }
  }

  private async handleConnectionUpdate(
    companyId: string,
    payload: Record<string, unknown>,
  ) {
    const data = payload.data as Record<string, unknown> | undefined;
    const state = (data?.state as string) || (data?.action as string) || "";

    const integration = await prisma.integration.findFirst({
      where: { companyId, type: "WHATSAPP" },
    });
    if (!integration) return;

    let connectionStatus: "CONNECTED" | "DISCONNECTED" | "CONNECTING";

    if (state === "open" || state === "CONNECTED") {
      connectionStatus = "CONNECTED";
    } else if (state === "connecting" || state === "CONNECTING") {
      connectionStatus = "CONNECTING";
    } else {
      connectionStatus = "DISCONNECTED";
    }

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        connectionStatus,
        connectedAt:
          connectionStatus === "CONNECTED"
            ? new Date()
            : integration.connectedAt,
        qrCode: connectionStatus === "CONNECTED" ? null : integration.qrCode,
      },
    });

    logger.info(
      `[Evolution Webhook] Connection status updated: ${connectionStatus} for company ${companyId}`,
    );
  }

  private async handleQrCodeUpdate(
    companyId: string,
    payload: Record<string, unknown>,
  ) {
    const data = payload.data as Record<string, unknown> | undefined;
    const qrCode = (data?.qrcode as string) || (data?.base64 as string) || null;

    const integration = await prisma.integration.findFirst({
      where: { companyId, type: "WHATSAPP" },
    });
    if (!integration) return;

    if (qrCode) {
      await prisma.integration.update({
        where: { id: integration.id },
        data: { qrCode, connectionStatus: "CONNECTING" },
      });
    }

    logger.info(`[Evolution Webhook] QR Code updated for company ${companyId}`);
  }

  private async handleIncomingMessage(
    companyId: string,
    payload: Record<string, unknown>,
  ) {
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return { handled: false };

    const key = data.key as Record<string, unknown> | undefined;
    const messageData = data.message as Record<string, unknown> | undefined;
    const pushName = (data.pushName as string) || "";

    if (!key || key.fromMe === true) return { handled: false };

    const remoteJid = (key.remoteJid as string) || "";
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    const externalId = (key.id as string) || "";
    let content =
      (messageData?.conversation as string) ||
      ((messageData?.extendedTextMessage as Record<string, unknown>)
        ?.text as string) ||
      "";

    let mediaType: string | null = null;
    let mediaUrl: string | null = null;

    if (!content) {
      if (messageData?.imageMessage) {
        mediaType = "image";
        content =
          ((messageData.imageMessage as Record<string, unknown>)
            ?.caption as string) || "[imagem]";
        mediaUrl =
          ((messageData.imageMessage as Record<string, unknown>)
            ?.url as string) || null;
      } else if (messageData?.videoMessage) {
        mediaType = "video";
        content =
          ((messageData.videoMessage as Record<string, unknown>)
            ?.caption as string) || "[vídeo]";
      } else if (messageData?.audioMessage) {
        mediaType = "audio";
        content = "[áudio]";
      } else if (messageData?.documentMessage) {
        mediaType = "document";
        content =
          ((messageData.documentMessage as Record<string, unknown>)
            ?.fileName as string) || "[documento]";
      } else {
        content = "[media]";
      }
    }

    if (!phone) return { handled: false };

    const existingMsg = externalId
      ? await prisma.message.findUnique({ where: { externalId } })
      : null;
    if (existingMsg) {
      logger.info(
        `[Evolution Webhook] Duplicate message ignored: ${externalId}`,
      );
      return { handled: false };
    }

    const { UserService } = await import("../../users/user.service");
    const userService = new UserService();

    let conversation = await prisma.conversation.findFirst({
      where: {
        contactPhone: { contains: phone },
        companyId,
        status: { notIn: ["CLOSED"] },
        channel: "WHATSAPP",
      },
    });

    if (!conversation) {
      const assignedToId =
        await userService.getNextEmployeeRoundRobin(companyId);

      conversation = await prisma.conversation.create({
        data: {
          contactName: pushName || phone,
          contactPhone: phone,
          channel: "WHATSAPP",
          companyId,
          assignedToId,
          status: "OPEN",
        },
      });

      logger.info(
        `[Evolution Webhook] New conversation: ${conversation.id}, assigned to: ${assignedToId}`,
      );
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "CLIENT",
        content,
        externalId: externalId || undefined,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    logger.info(
      `[Evolution Webhook] Message saved from ${phone} in conversation ${conversation.id}`,
    );

    return { handled: true, conversationId: conversation.id };
  }

  async getConfig(companyId: string) {
    const integration = await prisma.integration.findFirst({
      where: { companyId, type: "WHATSAPP" },
    });

    if (!integration) {
      return {
        instanceName: null,
        connectionStatus: "DISCONNECTED",
        webhookUrl: null,
        connectedAt: null,
        status: "INACTIVE",
      };
    }

    return {
      instanceName: integration.instanceName,
      connectionStatus: integration.connectionStatus,
      webhookUrl: integration.webhookUrl,
      connectedAt: integration.connectedAt,
      status: integration.status,
      instanceId: integration.instanceId,
    };
  }

  async saveConfig(
    companyId: string,
    data: { webhookUrl?: string; status?: string },
  ) {
    const integration = await prisma.integration.findFirst({
      where: { companyId, type: "WHATSAPP" },
    });

    if (!integration) {
      throw new AppError(
        "WhatsApp integration not found for this company",
        404,
      );
    }

    const updateData: Record<string, unknown> = {};
    if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;
    if (data.status !== undefined) updateData.status = data.status;

    return prisma.integration.update({
      where: { id: integration.id },
      data: updateData as any,
    });
  }

  private async getIntegration(companyId: string) {
    const integration = await prisma.integration.findFirst({
      where: { companyId, type: "WHATSAPP" },
    });

    if (!integration) {
      throw new AppError(
        "WhatsApp integration not found for this company",
        404,
      );
    }

    if (!integration.instanceName) {
      throw new AppError(
        "WhatsApp instance not created yet. Use /connect first.",
        400,
      );
    }

    return integration;
  }
}
