import * as wppconnect from "@wppconnect-team/wppconnect";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import prisma from "../../../config/prisma";
import { emitMessageCreated } from "../../../realtime";
import { AppError } from "../../../utils/AppError";
import { logger } from "../../../utils/logger";
import { normalizePhone } from "../../../utils/phone";
import { isLikelyBase64Payload, saveBase64Media } from "../../../utils/media";

export interface SendMediaOptions {
  number: string;
  type: "image" | "video" | "audio" | "document";
  url?: string;
  base64?: string;
  caption?: string;
  fileName?: string;
}

// In-memory map: integrationId -> WPPConnect client (connected sessions)
const sessions = new Map<string, wppconnect.Whatsapp>();

// Track pending browser creations so we can close zombie browsers
const pendingBrowsers = new Map<
  string,
  { sessionName: string; resolve: ((v: string | null) => void) | null }
>();

// Memory-based token store — prevents file caching that skips catchQR
const memoryTokenStore = new wppconnect.tokenStore.MemoryTokenStore();

// Concurrency guard: one create/reconnect per integration at a time
const busyIntegrations = new Set<string>();

const TOKENS_DIR = join(process.cwd(), "tokens");

function cleanupTokenFolder(sessionName: string): void {
  try {
    const folder = join(TOKENS_DIR, sessionName);
    if (existsSync(folder)) {
      rmSync(folder, { recursive: true, force: true });
      logger.info(`[WPPConnect] Cleaned up tokens folder: ${sessionName}`);
    }
  } catch (err) {
    logger.warn(
      `[WPPConnect] Cleanup failed for ${sessionName}: ${(err as Error).message}`,
    );
  }
}

export class WppConnectService {
  // ─── Shared create helper ─────────────────────────────────────
  private startSession(
    sessionName: string,
    integrationId: string,
    companyId: string,
  ): Promise<string | null> {
    return new Promise<string | null>((resolveQr) => {
      let qrResolved = false;

      const finish = (qr: string | null) => {
        if (!qrResolved) {
          qrResolved = true;
          resolveQr(qr);
        }
      };

      // Track this pending browser
      pendingBrowsers.set(integrationId, { sessionName, resolve: finish });

      wppconnect
        .create({
          session: sessionName,
          headless: true,
          useChrome: false,
          updatesLog: false,
          logQR: false,
          autoClose: 300000, // 5 min safety net — kills browser if QR never scanned
          tokenStore: "file", // file store saves token for restart restore
          catchQR: (base64Qr: string, _asciiQR: string, attempt: number) => {
            logger.info(
              `[WPPConnect] catchQR fired for ${sessionName} (attempt ${attempt})`,
            );
            // Save QR to DB
            prisma.integration
              .update({
                where: { id: integrationId },
                data: { qrCode: base64Qr, connectionStatus: "CONNECTING" },
              })
              .catch((err) =>
                logger.error(
                  `[WPPConnect] Failed to save QR for ${sessionName}: ${err.message}`,
                ),
              );

            // Resolve HTTP response with QR on first call
            finish(base64Qr);
          },
          statusFind: (statusSession: string) => {
            logger.info(
              `[WPPConnect] Session ${sessionName} status: ${statusSession}`,
            );
          },
        })
        .then(async (client) => {
          // Session fully connected (QR was scanned)
          pendingBrowsers.delete(integrationId);
          sessions.set(integrationId, client);
          this.registerEventHandlers(client, integrationId, companyId);

          await prisma.integration.update({
            where: { id: integrationId },
            data: {
              connectionStatus: "CONNECTED",
              connectedAt: new Date(),
              qrCode: null,
            },
          });

          logger.info(
            `[WPPConnect] Session connected: ${sessionName} (${integrationId})`,
          );
        })
        .catch(async (error) => {
          pendingBrowsers.delete(integrationId);
          await prisma.integration
            .update({
              where: { id: integrationId },
              data: { connectionStatus: "DISCONNECTED" },
            })
            .catch(() => {});

          logger.error(
            `[WPPConnect] Session ${sessionName} failed: ${(error as Error).message}`,
          );
          finish(null);
        });

      // Safety timeout: if QR doesn't arrive within 90s
      setTimeout(() => {
        finish(null);
      }, 90_000);
    });
  }

  // ─── Close any existing / pending session for an integration ──
  private async closeExisting(integrationId: string): Promise<void> {
    // Close connected client
    const client = sessions.get(integrationId);
    if (client) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      sessions.delete(integrationId);
    }

    // Close pending browser (zombie from timed-out create)
    const pending = pendingBrowsers.get(integrationId);
    if (pending) {
      cleanupTokenFolder(pending.sessionName);
      pendingBrowsers.delete(integrationId);
    }
  }

  // ─── Create Session ─────────────────────────────────────────
  async createSession(
    companyId: string,
    label?: string,
  ): Promise<{ integrationId: string; qrCode: string | null }> {
    await this.enforcePlanLimit(companyId);

    const sessionName = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create integration record
    const integration = await prisma.integration.create({
      data: {
        type: "WHATSAPP",
        token: sessionName,
        companyId,
        status: "ACTIVE",
        instanceName: label || sessionName,
        instanceId: sessionName,
        connectionStatus: "CONNECTING",
      },
    });

    const integrationId = integration.id;

    if (busyIntegrations.has(integrationId)) {
      throw new AppError("Esta sessão já está sendo conectada.", 409);
    }
    busyIntegrations.add(integrationId);

    try {
      const qr = await this.startSession(sessionName, integrationId, companyId);

      if (!qr) {
        throw new AppError("Timeout aguardando QR code. Tente novamente.", 504);
      }

      return { integrationId, qrCode: qr };
    } finally {
      busyIntegrations.delete(integrationId);
    }
  }

  // ─── List Sessions ──────────────────────────────────────────
  async listSessions(companyId: string) {
    const integrations = await prisma.integration.findMany({
      where: { companyId, type: "WHATSAPP" },
      orderBy: { createdAt: "desc" },
    });

    // Sync in-memory status
    return integrations.map((i) => ({
      id: i.id,
      label: i.instanceName,
      connectionStatus: sessions.has(i.id)
        ? i.connectionStatus
        : i.connectionStatus === "CONNECTED"
          ? "DISCONNECTED"
          : i.connectionStatus,
      connectedAt: i.connectedAt,
      qrCode: i.connectionStatus === "CONNECTING" ? i.qrCode : null,
      createdAt: i.createdAt,
    }));
  }

  // ─── Get Session Status ─────────────────────────────────────
  async getSessionStatus(integrationId: string, companyId: string) {
    const integration = await this.getIntegration(integrationId, companyId);
    const client = sessions.get(integrationId);

    let status = integration.connectionStatus;
    if (!client && status === "CONNECTED") {
      status = "DISCONNECTED";
      await prisma.integration.update({
        where: { id: integrationId },
        data: { connectionStatus: "DISCONNECTED" },
      });
    }

    return {
      id: integration.id,
      label: integration.instanceName,
      status,
      connectedAt: integration.connectedAt,
      qrCode: status === "CONNECTING" ? integration.qrCode : null,
    };
  }

  // ─── Get QR Code ────────────────────────────────────────────
  async getQrCode(integrationId: string, companyId: string) {
    const integration = await this.getIntegration(integrationId, companyId);
    return {
      qrCode: integration.qrCode,
      label: integration.instanceName,
    };
  }

  // ─── Reconnect ──────────────────────────────────────────────
  async reconnect(integrationId: string, companyId: string) {
    const integration = await this.getIntegration(integrationId, companyId);

    if (busyIntegrations.has(integrationId)) {
      throw new AppError("Esta sessão já está sendo conectada.", 409);
    }
    busyIntegrations.add(integrationId);

    try {
      // Close existing / zombie sessions
      await this.closeExisting(integrationId);

      // Fresh session name — unique to avoid folder conflicts
      const sessionName = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Clean old token folder if it exists
      if (integration.instanceId) {
        cleanupTokenFolder(integration.instanceId);
      }

      // Update instanceId in DB
      await prisma.integration.update({
        where: { id: integrationId },
        data: { instanceId: sessionName, connectionStatus: "CONNECTING" },
      });

      const qr = await this.startSession(
        sessionName,
        integrationId,
        integration.companyId,
      );

      if (!qr) {
        throw new AppError("Timeout aguardando QR code. Tente novamente.", 504);
      }

      return { qrCode: qr, label: integration.instanceName };
    } finally {
      busyIntegrations.delete(integrationId);
    }
  }

  // ─── Disconnect ─────────────────────────────────────────────
  async disconnect(integrationId: string, companyId: string) {
    const integration = await this.getIntegration(integrationId, companyId);
    const client = sessions.get(integrationId);

    if (client) {
      try {
        await client.logout();
      } catch {
        logger.warn(
          `[WPPConnect] Logout failed for ${integration.instanceName}`,
        );
      }
      try {
        await client.close();
      } catch {
        logger.warn(
          `[WPPConnect] Close failed for ${integration.instanceName}`,
        );
      }
      sessions.delete(integrationId);
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        connectionStatus: "DISCONNECTED",
        qrCode: null,
        connectedAt: null,
      },
    });

    logger.info(
      `[WPPConnect] Session disconnected: ${integration.instanceName}`,
    );
    return { message: "WhatsApp disconnected successfully" };
  }

  // ─── Send Message (specific session) ────────────────────────
  async sendMessage(
    integrationId: string,
    companyId: string,
    phone: string,
    text: string,
  ): Promise<{ externalId: string | null }> {
    await this.getIntegration(integrationId, companyId);
    const client = this.getClient(integrationId);
    const chatId = this.resolveChatId(phone);

    try {
      const result = await client.sendText(chatId, text);
      const externalId =
        typeof (result as any)?.id === "string"
          ? (result as any).id
          : (result as any)?.id?._serialized || null;
      logger.info(
        `[WPPConnect] Message sent to ${chatId}, externalId: ${externalId}`,
      );
      return { externalId };
    } catch (error) {
      logger.error(
        `[WPPConnect] Failed to send message to ${chatId}: ${(error as Error).message}`,
      );
      throw new AppError("Failed to send WhatsApp message", 500);
    }
  }

  // ─── Send Media (specific session) ──────────────────────────
  async sendMedia(
    integrationId: string,
    companyId: string,
    options: SendMediaOptions,
  ): Promise<{ externalId: string | null }> {
    await this.getIntegration(integrationId, companyId);
    const client = this.getClient(integrationId);
    const chatId = this.resolveChatId(options.number);

    try {
      let result: any;
      const mediaSource = options.url || options.base64;
      if (!mediaSource) {
        throw new AppError(
          "Either url or base64 must be provided for media",
          400,
        );
      }

      switch (options.type) {
        case "image":
          result = await client.sendImage(
            chatId,
            mediaSource,
            options.fileName || "image",
            options.caption || "",
          );
          break;
        case "video":
          result = await client.sendVideoAsGif(
            chatId,
            mediaSource,
            options.fileName || "video",
            options.caption || "",
          );
          break;
        case "audio":
          result = await client.sendPtt(chatId, mediaSource);
          break;
        case "document":
          result = await client.sendFile(
            chatId,
            mediaSource,
            options.fileName || "document",
            options.caption || "",
          );
          break;
        default:
          result = await client.sendFile(
            chatId,
            mediaSource,
            options.fileName || "file",
            options.caption || "",
          );
      }

      const externalId =
        typeof result?.id === "string"
          ? result.id
          : result?.id?._serialized || null;
      logger.info(
        `[WPPConnect] Media (${options.type}) sent to ${chatId}, externalId: ${externalId}`,
      );
      return { externalId };
    } catch (error) {
      logger.error(
        `[WPPConnect] Failed to send media to ${chatId}: ${(error as Error).message}`,
      );
      throw new AppError("Failed to send WhatsApp media", 500);
    }
  }

  // ─── Auto-select session and send ──────────────────────────
  async sendMessageAuto(
    companyId: string,
    phone: string,
    text: string,
  ): Promise<{ externalId: string | null }> {
    const integrationId = await this.pickConnectedSession(companyId);
    return this.sendMessage(integrationId, companyId, phone, text);
  }

  async sendMediaAuto(
    companyId: string,
    options: SendMediaOptions,
  ): Promise<{ externalId: string | null }> {
    const integrationId = await this.pickConnectedSession(companyId);
    return this.sendMedia(integrationId, companyId, options);
  }

  // ─── Restore Sessions on Startup ───────────────────────────
  async restoreSessionsOnStartup(): Promise<void> {
    try {
      const integrations = await prisma.integration.findMany({
        where: {
          type: "WHATSAPP",
          status: "ACTIVE",
          connectionStatus: "CONNECTED",
        },
      });

      logger.info(
        `[WPPConnect Startup] Found ${integrations.length} session(s) to restore`,
      );

      for (const integration of integrations) {
        if (!integration.instanceId) continue;

        // Fire-and-forget: restore each session in background
        const id = integration.id;
        const instanceId = integration.instanceId;
        const companyId = integration.companyId;

        wppconnect
          .create({
            session: instanceId,
            headless: true,
            useChrome: false,
            updatesLog: false,
            logQR: false,
            autoClose: 0, // never auto-close restored sessions
            tokenStore: "file", // file store allows auto-reconnect with saved tokens
            catchQR: (base64Qr: string) => {
              prisma.integration
                .update({
                  where: { id },
                  data: { qrCode: base64Qr, connectionStatus: "CONNECTING" },
                })
                .catch(() => {});
            },
            statusFind: (statusSession: string) => {
              logger.info(
                `[WPPConnect Startup] ${instanceId} status: ${statusSession}`,
              );
            },
          })
          .then(async (client) => {
            sessions.set(id, client);
            this.registerEventHandlers(client, id, companyId);

            await prisma.integration.update({
              where: { id },
              data: { connectionStatus: "CONNECTED", connectedAt: new Date() },
            });

            logger.info(`[WPPConnect Startup] Restored session: ${instanceId}`);
          })
          .catch(async (err) => {
            logger.warn(
              `[WPPConnect Startup] Failed to restore ${instanceId}: ${(err as Error).message}`,
            );
            await prisma.integration
              .update({
                where: { id },
                data: { connectionStatus: "DISCONNECTED" },
              })
              .catch(() => {});
          });
      }
    } catch (error) {
      logger.error(`[WPPConnect Startup] Failed: ${(error as Error).message}`);
    }
  }

  // ─── Private Helpers ────────────────────────────────────────

  private registerEventHandlers(
    client: wppconnect.Whatsapp,
    integrationId: string,
    companyId: string,
  ) {
    logger.info(
      `[WPPConnect] Registering event handlers for ${integrationId} (company: ${companyId})`,
    );

    client.onStateChange((state: string) => {
      logger.info(`[WPPConnect] State change for ${integrationId}: ${state}`);

      let connectionStatus: "CONNECTED" | "DISCONNECTED" | "CONNECTING";
      if (state === "CONNECTED") {
        connectionStatus = "CONNECTED";
      } else if (state === "UNPAIRED" || state === "CONFLICT") {
        connectionStatus = "DISCONNECTED";
        sessions.delete(integrationId);
      } else {
        connectionStatus = "CONNECTING";
      }

      prisma.integration
        .update({
          where: { id: integrationId },
          data: {
            connectionStatus,
            connectedAt:
              connectionStatus === "CONNECTED" ? new Date() : undefined,
            qrCode: connectionStatus === "CONNECTED" ? null : undefined,
          },
        })
        .catch((err) =>
          logger.error(`[WPPConnect] Failed to update state: ${err.message}`),
        );
    });

    client.onAnyMessage(async (message: any) => {
      try {
        if (message.fromMe) return;
        if (message.isGroupMsg) return;
        const rawFrom = this.serializeWid(message.from);
        if (!rawFrom) return;
        if (rawFrom === "status@broadcast" || rawFrom.endsWith("@broadcast")) {
          return;
        }

        logger.info(
          `[WPPConnect] Incoming message from ${rawFrom}: ${(message.body || "").substring(0, 50)}`,
        );

        const identityCandidates = this.getContactCandidates(message);
        const contactRemoteId =
          this.getPreferredRemoteId(identityCandidates) || rawFrom;
        const phoneCandidates = identityCandidates.flatMap((candidate) =>
          this.getPhoneCandidates(candidate),
        );
        const normalizedContactPhone = this.getPreferredPhone(
          phoneCandidates,
          contactRemoteId,
        );
        const displayPhone = this.getDisplayPhone(
          normalizedContactPhone || contactRemoteId,
        );
        const pushName = this.getPreferredContactName(message, displayPhone);
        const externalId =
          typeof message.id === "string"
            ? message.id
            : message.id?._serialized || String(message.id || "");
        const mediaType = this.getIncomingMediaType(message.type);
        const mediaPayload = mediaType
          ? await this.resolveIncomingMedia(client, message, companyId)
          : null;
        let content = this.getIncomingContent(message, mediaType);
        const avatarUrl = await this.resolveContactAvatar(
          client,
          message,
          contactRemoteId,
        );

        if (phoneCandidates.length === 0) return;

        if (externalId) {
          const existing = await prisma.message.findUnique({
            where: { externalId },
          });
          if (existing) return;
        }

        let conversation = await prisma.conversation.findFirst({
          where: {
            companyId,
            status: { notIn: ["CLOSED"] },
            channel: "WHATSAPP",
            OR: [
              ...phoneCandidates.map((candidate) => ({
                contactPhone: candidate,
              })),
              ...identityCandidates.map((candidate) => ({
                contactRemoteId: candidate,
              })),
            ],
          },
        });

        if (!conversation) {
          const { UserService } = await import("../../users/user.service");
          const userService = new UserService();
          const assignedToId =
            await userService.getNextEmployeeRoundRobin(companyId);

          conversation = await prisma.conversation.create({
            data: {
              contactName: pushName || displayPhone,
              contactPhone: normalizedContactPhone || rawFrom,
              contactRemoteId,
              contactAvatarUrl: avatarUrl || null,
              channel: "WHATSAPP",
              companyId,
              assignedToId,
              status: "OPEN",
            },
          });

          logger.info(
            `[WPPConnect] New conversation: ${conversation.id}, assigned to: ${assignedToId}`,
          );
        }

        const updated = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            updatedAt: new Date(),
            contactName: pushName || conversation.contactName,
            contactPhone: normalizedContactPhone || conversation.contactPhone,
            contactRemoteId: contactRemoteId || conversation.contactRemoteId,
            contactAvatarUrl:
              avatarUrl || conversation.contactAvatarUrl || null,
          },
        });

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            sender: "CLIENT",
            content,
            externalId: externalId || undefined,
            mediaType: mediaPayload?.mediaType,
            mediaUrl: mediaPayload?.mediaUrl,
            mimeType: mediaPayload?.mimeType,
            fileName: mediaPayload?.fileName,
            fileSize: mediaPayload?.fileSize,
          },
        });
        emitMessageCreated(updated);

        if (conversation.leadId && avatarUrl) {
          await prisma.lead.updateMany({
            where: {
              id: conversation.leadId,
              companyId,
              OR: [{ avatarUrl: null }, { avatarUrl: "" }],
            },
            data: { avatarUrl },
          });
        }

        logger.info(
          `[WPPConnect] Message from ${rawFrom} in conversation ${conversation.id}`,
        );
      } catch (err) {
        logger.error(
          `[WPPConnect] Error handling incoming message: ${(err as Error).message}`,
        );
      }
    });
  }

  private resolveChatId(phone: string): string {
    const value = String(phone || "").trim();
    if (!value) {
      throw new AppError("Invalid WhatsApp destination", 400);
    }
    if (value.includes("@")) {
      return value;
    }
    return `${normalizePhone(value)}@c.us`;
  }

  private serializeWid(value: any): string {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value?._serialized === "string") {
      return value._serialized.trim();
    }
    if (typeof value?.user === "string" && typeof value?.server === "string") {
      return `${value.user}@${value.server}`;
    }
    return String(value || "").trim();
  }

  private getContactCandidates(message: any): string[] {
    return Array.from(
      new Set(
        [
          this.serializeWid(message.from),
          this.serializeWid(message.chatId),
          this.serializeWid(message.chat?.id),
          this.serializeWid(message.sender?.id),
          this.serializeWid(message.chat?.contact?.id),
        ].filter(Boolean),
      ),
    );
  }

  private getDigitsFromContactId(value: string): string {
    return String(value || "")
      .replace(/@c\.us|@s\.whatsapp\.net|@lid/g, "")
      .replace(/\D/g, "");
  }

  private isLikelyPhoneDigits(value: string): boolean {
    const digits = this.getDigitsFromContactId(value);
    return digits.length >= 10 && digits.length <= 13;
  }

  private getPreferredRemoteId(candidates: string[]): string {
    return (
      candidates.find(
        (candidate) =>
          (candidate.endsWith("@c.us") ||
            candidate.endsWith("@s.whatsapp.net")) &&
          this.isLikelyPhoneDigits(candidate),
      ) ||
      candidates.find((candidate) => candidate.includes("@")) ||
      candidates[0] ||
      ""
    );
  }

  private getPreferredPhone(candidates: string[], fallback: string): string {
    const preferred =
      candidates.find(
        (candidate) =>
          (candidate.endsWith("@c.us") ||
            candidate.endsWith("@s.whatsapp.net")) &&
          this.isLikelyPhoneDigits(candidate),
      ) ||
      candidates.find((candidate) => this.isLikelyPhoneDigits(candidate)) ||
      fallback;

    const digits = this.getDigitsFromContactId(preferred);
    return this.isLikelyPhoneDigits(digits)
      ? normalizePhone(digits)
      : preferred;
  }

  private getDisplayPhone(value: string): string {
    const digits = this.getDigitsFromContactId(value);
    if (!digits) {
      return String(value || "").trim();
    }

    return digits;
  }

  private getPreferredContactName(message: any, fallback: string): string {
    return (
      message.sender?.pushname ||
      message.sender?.name ||
      message.sender?.formattedName ||
      message.notifyName ||
      fallback
    );
  }

  private getIncomingMediaType(type: string): string | null {
    if (type === "image") return "image";
    if (type === "video") return "video";
    if (type === "ptt" || type === "audio") return "audio";
    if (type === "document") return "document";
    return null;
  }

  private getMediaPlaceholder(
    mediaType: string | null,
    fileName?: string,
  ): string {
    if (mediaType === "image") return "[imagem]";
    if (mediaType === "video") return "[vídeo]";
    if (mediaType === "audio") return "[áudio]";
    if (mediaType === "document") return fileName || "[documento]";
    return "[mídia recebida]";
  }

  private getIncomingContent(message: any, mediaType: string | null): string {
    const rawContent = String(message.caption || message.body || "").trim();
    if (!rawContent || isLikelyBase64Payload(rawContent)) {
      return this.getMediaPlaceholder(mediaType, message.filename);
    }
    return rawContent;
  }

  private async resolveContactAvatar(
    client: wppconnect.Whatsapp,
    message: any,
    contactRemoteId: string,
  ): Promise<string | null> {
    const thumb =
      message.sender?.profilePicThumbObj?.eurl ||
      message.sender?.profilePicThumbObj?.imgFull ||
      message.sender?.profilePicThumbObj?.img;

    if (thumb) {
      return thumb;
    }

    if (!contactRemoteId) return null;

    try {
      const pic = await client.getProfilePicFromServer(contactRemoteId);
      return pic?.eurl || pic?.imgFull || pic?.img || null;
    } catch {
      return null;
    }
  }

  private async resolveIncomingMedia(
    client: wppconnect.Whatsapp,
    message: any,
    companyId: string,
  ): Promise<{
    mediaType: string;
    mediaUrl: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
  } | null> {
    try {
      const mediaType = this.getIncomingMediaType(message.type);
      if (!mediaType) return null;

      const base64 = await client.downloadMedia(message.id || message);
      if (!base64) return null;

      const saved = await saveBase64Media({
        base64,
        directory: `chat-media/${companyId}`,
        fileName: message.filename || message.type || "media",
        mimeType: message.mimetype || undefined,
      });

      return {
        mediaType,
        mediaUrl: saved.url,
        mimeType: saved.mimeType,
        fileName: message.filename || saved.fileName,
        fileSize: saved.size,
      };
    } catch (error) {
      logger.warn(
        `[WPPConnect] Failed to persist incoming media: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private getPhoneCandidates(phone: string): string[] {
    const raw = String(phone || "").trim();
    const digits = raw.replace(/\D/g, "");
    const stripped = raw
      .replace("@c.us", "")
      .replace("@s.whatsapp.net", "")
      .replace("@lid", "");

    return Array.from(
      new Set(
        [raw, stripped, digits ? normalizePhone(digits) : undefined].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    );
  }

  private async enforcePlanLimit(companyId: string): Promise<void> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { _count: { select: { integrations: true } } },
    });

    if (!company) throw new AppError("Company not found", 404);

    const plan = await (prisma as any).plan.findFirst({
      where: { slug: company.plan, isActive: true },
    });

    if (plan && company._count.integrations >= plan.maxNumbers) {
      throw new AppError(
        `Limite do plano atingido: máximo de ${plan.maxNumbers} número(s) no plano ${plan.name}. Faça upgrade para conectar mais números.`,
        403,
      );
    }
  }

  private async pickConnectedSession(companyId: string): Promise<string> {
    const integrations = await prisma.integration.findMany({
      where: {
        companyId,
        type: "WHATSAPP",
        connectionStatus: "CONNECTED",
        status: "ACTIVE",
      },
    });

    // Filter to only those with active in-memory sessions
    const active = integrations.filter((i) => sessions.has(i.id));

    if (active.length === 0) {
      throw new AppError("No connected WhatsApp session for this company", 400);
    }

    // Simple round-robin via random pick
    const picked = active[Math.floor(Math.random() * active.length)];
    return picked.id;
  }

  private getClient(integrationId: string): wppconnect.Whatsapp {
    const client = sessions.get(integrationId);
    if (!client) {
      throw new AppError(
        "WhatsApp session not found or disconnected. Reconnect first.",
        400,
      );
    }
    return client;
  }

  private async getIntegration(integrationId: string, companyId: string) {
    const integration = await prisma.integration.findFirst({
      where: { id: integrationId, companyId },
    });

    if (!integration) {
      throw new AppError("WhatsApp integration not found", 404);
    }

    return integration;
  }
}

// Singleton instance
export const wppConnectService = new WppConnectService();
