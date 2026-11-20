import { z } from "zod";
import * as wppconnect from "@wppconnect-team/wppconnect";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import prisma from "../../../config/prisma";
import {
  emitConversationTyping,
  emitMessageCreated,
  emitMessageUpdated,
} from "../../../realtime";
import { AppError } from "../../../utils/AppError";
import { logger } from "../../../utils/logger";
import { normalizePhone } from "../../../utils/phone";
import { isLikelyBase64Payload, saveBase64Media, saveMediaBuffer } from "../../../utils/media";
import { getWhatsAppChatId, getWhatsAppMessageKey } from "../../messages/message-rules";

export interface SendMediaOptions {
  number: string;
  type: "image" | "video" | "audio" | "document" | "sticker";
  url?: string;
  base64?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
  quotedMsg?: string;
}

const IGNORED_MESSAGE_TYPES = new Set(["e2e_notification", "notification_template", "protocol", "revoked", "gp2", "call_log"]);
const INCOMING_MEDIA_TYPES: Record<string, string> = {
  image: "image",
  sticker: "sticker",
  video: "video",
  ptt: "audio",
  audio: "audio",
  document: "document",
};
const SAVED_STICKERS_SCRIPT = `(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("model-storage");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const readAll = (storeName) => new Promise((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve([]);
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  const favorites = (await readAll("favorite-stickers")).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const recents = (await readAll("recent-stickers")).sort((a, b) => (b.weight || 0) - (a.weight || 0));
  db.close();

  const seen = new Set();
  const entries = [];
  for (const [source, list] of [["favorite", favorites], ["recent", recents]]) {
    for (const record of list) {
      const sticker = record.sticker;
      if (!sticker?.filehash || !sticker.directPath || seen.has(sticker.filehash)) continue;
      seen.add(sticker.filehash);
      entries.push({ source, sticker });
    }
  }

  const errors = [];
  const download = async ({ source, sticker }) => {
    try {
      const { LruMediaStore, MediaBlobCache, StickerModel } = WPP.whatsapp;
      const mimetype = sticker.mimetype || "image/webp";
      const fromCache = async () => {
        const stored = LruMediaStore?.get ? await LruMediaStore.get(sticker.filehash).catch(() => null) : null;
        if (stored) return new Blob([stored instanceof ArrayBuffer || ArrayBuffer.isView(stored) ? stored : stored.buffer ?? stored], { type: mimetype });
        if (MediaBlobCache?.has?.(sticker.filehash)) return MediaBlobCache.get(sticker.filehash);
        return null;
      };
      let blob = await fromCache();
      let stage = "cache";
      if (!blob) {
        const model = new StickerModel({ ...sticker, id: sticker.filehash });
        const fetchMedia = () => model.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1, isUserInitiated: true });
        await Promise.race([fetchMedia(), new Promise((resolve) => setTimeout(resolve, 3000))]);
        blob = (await fromCache()) || model.mediaData?.mediaBlob?.forceToBlob?.() || null;
        const url = !blob && model.mediaData?.renderableUrl;
        if (url) blob = await fetch(url).then((response) => response.blob());
        stage = String(model.mediaData?.mediaStage) + "/" + source;
      }
      if (!blob) throw new Error("sem mídia após download (" + stage + ")");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      return { id: sticker.filehash, source, dataUrl: "data:" + (blob.type || sticker.mimetype || "image/webp") + ";base64," + btoa(binary) };
    } catch (error) {
      errors.push(String(error?.message || error));
      return null;
    }
  };

  const runBatches = async (list) => {
    const found = [];
    for (let index = 0; index < list.length; index += 10) {
      const batch = await Promise.all(list.slice(index, index + 10).map(download));
      found.push(...batch.filter(Boolean));
    }
    return found;
  };
  const selected = entries.slice(0, 90);
  const result = await runBatches(selected);
  const order = new Map(selected.map(({ sticker }, index) => [sticker.filehash, index]));
  result.sort((a, b) => order.get(a.id) - order.get(b.id));
  return { stickers: result, total: entries.length, errors: errors.slice(0, 3) };
})()`;
const savedStickersSchema = z.array(
  z.object({ id: z.string(), source: z.enum(["favorite", "recent"]), dataUrl: z.string().startsWith("data:image/") }),
);
type SavedSticker = z.infer<typeof savedStickersSchema>[number];
const SAVED_STICKERS_TTL_MS = 2 * 60 * 1000;
const savedStickersCache = new Map<string, { loadedAt: number; stickers: SavedSticker[] }>();
const savedStickersInFlight = new Map<string, Promise<SavedSticker[]>>();
const savedStickersResultSchema = z.object({
  stickers: savedStickersSchema,
  total: z.number(),
  errors: z.array(z.string()),
});
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

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

function toSendError(error: unknown): AppError {
  if (error instanceof Error && error.message.includes("No LID for user")) {
    return new AppError(
      "O WhatsApp ainda não libera conversa nova com este número. Peça para o contato mandar a primeira mensagem ou salve-o na agenda do celular conectado.",
      422,
    );
  }
  return new AppError("Failed to send WhatsApp message", 500);
}

type AckMessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

const ACK_ALLOWED_PREVIOUS_STATUS: Record<
  AckMessageStatus,
  AckMessageStatus[]
> = {
  SENT: [],
  DELIVERED: ["SENT", "FAILED"],
  READ: ["SENT", "DELIVERED", "FAILED"],
  FAILED: ["SENT"],
};

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
      where: { companyId, type: "WHATSAPP", provider: "WPPCONNECT" },
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
    quotedMsg?: string,
  ): Promise<{ externalId: string | null }> {
    await this.getIntegration(integrationId, companyId);
    const client = this.getClient(integrationId);
    const chatId = await this.resolveChatId(client, phone);

    try {
      const result = await client.sendText(chatId, text, quotedMsg ? { quotedMsg } : undefined);
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
      throw toSendError(error);
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
    const chatId = await this.resolveChatId(client, options.number);

    const source = options.url || options.base64;
    if (!source) {
      throw new AppError("Either url or base64 must be provided for media", 400);
    }
    const content =
      options.base64 && !options.base64.startsWith("data:") && options.mimeType
        ? `data:${options.mimeType};base64,${options.base64}`
        : source;

    try {
      const fileOptions = {
        type: options.type,
        filename: options.fileName || options.type,
        caption: options.type === "audio" ? undefined : options.caption || undefined,
        mimetype: options.mimeType,
        quotedMsg: options.quotedMsg,
        ...(options.type === "audio" ? { isPtt: true } : {}),
      };
      const result: { id?: string | { _serialized?: string } } | undefined =
        options.type === "sticker"
          ? options.mimeType === "image/gif"
            ? await client.sendImageAsStickerGif(chatId, content, { quotedMsg: options.quotedMsg })
            : await client.sendImageAsSticker(chatId, content, { quotedMsg: options.quotedMsg })
          : await client.sendFile(chatId, content, fileOptions);

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
    quotedMsg?: string,
  ): Promise<{ externalId: string | null }> {
    const integrationId = await this.pickConnectedSession(companyId);
    return this.sendMessage(integrationId, companyId, phone, text, quotedMsg);
  }

  async sendMediaAuto(
    companyId: string,
    options: SendMediaOptions,
  ): Promise<{ externalId: string | null }> {
    const integrationId = await this.pickConnectedSession(companyId);
    return this.sendMedia(integrationId, companyId, options);
  }

  async reactToMessage(companyId: string, externalId: string, emoji: string | null): Promise<void> {
    const client = this.getClient(await this.pickConnectedSession(companyId));
    try {
      await client.sendReactionToMessage(externalId, emoji ?? false);
    } catch (error) {
      logger.error(`[WPPConnect] Failed to react to ${externalId}: ${(error as Error).message}`);
      throw new AppError("Failed to react to WhatsApp message", 500);
    }
  }

  async editMessage(companyId: string, externalId: string, content: string): Promise<void> {
    const client = this.getClient(await this.pickConnectedSession(companyId));
    try {
      await client.editMessage(externalId, content);
    } catch (error) {
      logger.error(`[WPPConnect] Failed to edit ${externalId}: ${(error as Error).message}`);
      throw new AppError("Failed to edit WhatsApp message", 500);
    }
  }

  async listSavedStickers(companyId: string): Promise<SavedSticker[]> {
    const cached = savedStickersCache.get(companyId);
    if (cached && Date.now() - cached.loadedAt < SAVED_STICKERS_TTL_MS) return cached.stickers;
    const pending = savedStickersInFlight.get(companyId);
    if (pending) return pending;
    const loading = this.loadSavedStickers(companyId)
      .then((stickers) => {
        savedStickersCache.set(companyId, { loadedAt: Date.now(), stickers });
        return stickers;
      })
      .finally(() => savedStickersInFlight.delete(companyId));
    savedStickersInFlight.set(companyId, loading);
    return loading;
  }

  private async loadSavedStickers(companyId: string): Promise<SavedSticker[]> {
    const client = this.getClient(await this.pickConnectedSession(companyId));
    try {
      const result = savedStickersResultSchema.parse(await client.page.evaluate(SAVED_STICKERS_SCRIPT));
      if (result.errors.length || result.stickers.length < result.total) {
        logger.info(`[WPPConnect] Saved stickers: ${result.stickers.length}/${result.total} baixadas; erros: ${result.errors.join(" | ")}`);
      }
      return result.stickers;
    } catch (error) {
      logger.error(`[WPPConnect] Failed to list saved stickers: ${(error as Error).message}`);
      throw new AppError("Não foi possível carregar as figurinhas do WhatsApp", 502);
    }
  }

  async deleteMessage(companyId: string, destination: string, externalId: string): Promise<void> {
    const client = this.getClient(await this.pickConnectedSession(companyId));
    const chatId = getWhatsAppChatId(externalId) ?? await this.resolveChatId(client, destination);
    try {
      const deleted = await client.deleteMessage(chatId, externalId);
      if (deleted === false) throw new Error("deleteMessage returned false");
    } catch (error) {
      logger.error(`[WPPConnect] Failed to delete ${externalId}: ${(error as Error).message}`);
      throw new AppError("Failed to delete WhatsApp message", 500);
    }
  }

  // ─── Restore Sessions on Startup ───────────────────────────
  async restoreSessionsOnStartup(): Promise<void> {
    try {
      const integrations = await prisma.integration.findMany({
        where: {
          type: "WHATSAPP",
          provider: "WPPCONNECT",
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
        if (IGNORED_MESSAGE_TYPES.has(message.type)) return;

        client.subscribePresence(rawFrom).catch(() => {});

        logger.info(
          `[WPPConnect] Incoming message from ${rawFrom}: ${(message.body || "").substring(0, 50)}`,
        );

        const identityCandidates = this.getContactCandidates(message);
        if (rawFrom.endsWith("@lid")) {
          const entry = await client.getPnLidEntry(rawFrom).catch((err: Error) => {
            logger.warn(`[WPPConnect] getPnLidEntry failed for ${rawFrom}: ${err.message}`);
            return null;
          });
          const phoneId = entry?.phoneNumber?._serialized;
          if (phoneId) identityCandidates.unshift(phoneId);
        }
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
        if (phoneCandidates.length === 0) return;

        if (externalId) {
          const existing = await prisma.message.findUnique({
            where: { externalId },
          });
          if (existing) return;
        }

        const mediaType = this.getIncomingMediaType(message);
        const mediaPayload = mediaType
          ? await this.resolveIncomingMedia(client, message, companyId, mediaType)
          : null;
        const content = this.getIncomingContent(message, mediaType);

        let conversation = await prisma.conversation.findFirst({
          where: {
            companyId,
            status: { notIn: ["CLOSED"] },
            channel: "WHATSAPP",
            NOT: { integration: { is: { provider: "META" } } },
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

        const avatarUrl = conversation?.contactAvatarUrl?.startsWith("/uploads/")
          ? null
          : await this.resolveContactAvatar(client, message, contactRemoteId, companyId);

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

        const quotedId =
          this.serializeWid(message.quotedMsgId) || String(message.quotedStanzaID || "");
        const quoted = quotedId
          ? await this.findMessageByExternalId(quotedId, companyId)
          : null;

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            replyToId: quoted?.conversation.id === conversation.id ? quoted.id : undefined,
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
              OR: [
                { avatarUrl: null },
                { avatarUrl: "" },
                { avatarUrl: { startsWith: "https://pps.whatsapp.net" } },
              ],
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

    client.onAck(async (ack) => {
      try {
        const externalId = this.serializeWid(ack.id);
        logger.info(`[WPPConnect] Ack ${ack.ack} for ${externalId}`);
        const status = this.mapAckToStatus(ack.ack);
        if (!status || !externalId) return;

        const message = await this.findMessageByExternalId(externalId, companyId);
        if (!message) return;

        const result = await prisma.message.updateMany({
          where: {
            id: message.id,
            OR: [
              ...(status === "FAILED" ? [] : [{ status: null }]),
              { status: { in: ACK_ALLOWED_PREVIOUS_STATUS[status] } },
            ],
          },
          data: { status },
        });
        if (result.count > 0) emitMessageUpdated(message.conversation);
      } catch (err) {
        logger.error(`[WPPConnect] Error handling ack: ${(err as Error).message}`);
      }
    });

    client.onReactionMessage(async (data) => {
      try {
        if (this.serializeWid(data.id).startsWith("true_")) return;
        const message = await this.findMessageByExternalId(this.serializeWid(data.msgId), companyId);
        if (!message) return;

        await prisma.message.update({
          where: { id: message.id },
          data: { reaction: data.reactionText || null },
        });
        emitMessageUpdated(message.conversation);
      } catch (err) {
        logger.error(
          `[WPPConnect] Error handling reaction: ${(err as Error).message}`,
        );
      }
    });

    client.onRevokedMessage(async (data) => {
      try {
        const message = await this.findMessageByExternalId(this.serializeWid(data.refId), companyId);
        if (!message) return;

        const { count } = await prisma.message.updateMany({
          where: { id: message.id, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        if (count > 0) emitMessageUpdated(message.conversation);
      } catch (err) {
        logger.error(`[WPPConnect] Error handling revoke: ${(err as Error).message}`);
      }
    });

    client.onMessageEdit(async (data) => {
      try {
        const edited: { body?: string; caption?: string; id?: unknown } | undefined = data.msg;
        const content = String(edited?.body || edited?.caption || "").trim();
        if (!content) return;
        const message = await this.findMessageByExternalId(
          this.serializeWid(data.id) || this.serializeWid(edited?.id),
          companyId,
        );
        if (!message) return;

        const { count } = await prisma.message.updateMany({
          where: { id: message.id, deletedAt: null, NOT: { content } },
          data: { content, editedAt: new Date() },
        });
        if (count > 0) emitMessageUpdated(message.conversation);
      } catch (err) {
        logger.error(`[WPPConnect] Error handling edit: ${(err as Error).message}`);
      }
    });

    client.onPresenceChanged(async (event) => {
      try {
        if (!event.isUser) return;
        const contactId = this.serializeWid(event.id);
        if (!contactId) return;

        const conversation = await prisma.conversation.findFirst({
          where: {
            companyId,
            status: { notIn: ["CLOSED"] },
            channel: "WHATSAPP",
            NOT: { integration: { is: { provider: "META" } } },
            OR: [
              ...this.getPhoneCandidates(contactId).map((candidate) => ({
                contactPhone: candidate,
              })),
              { contactRemoteId: contactId },
            ],
          },
          select: { id: true, companyId: true, assignedToId: true },
        });
        if (!conversation) return;

        emitConversationTyping(
          conversation,
          event.state === "composing" || event.state === "recording",
        );
      } catch (err) {
        logger.error(
          `[WPPConnect] Error handling presence: ${(err as Error).message}`,
        );
      }
    });
  }

  private mapAckToStatus(ack: number): AckMessageStatus | null {
    if (ack < 0) return "FAILED";
    if (ack === 1) return "SENT";
    if (ack === 2) return "DELIVERED";
    if (ack === 3 || ack === 4) return "READ";
    return null;
  }

  private async findMessageByExternalId(externalId: string, companyId: string) {
    if (!externalId) return null;
    const select = {
      id: true,
      conversation: { select: { id: true, companyId: true, assignedToId: true } },
    } as const;
    const exact = await prisma.message.findFirst({
      where: { externalId, conversation: { companyId } },
      select,
    });
    if (exact) return exact;

    const key = getWhatsAppMessageKey(externalId);
    if (!key) return null;
    return prisma.message.findFirst({
      where: { externalId: { endsWith: `_${key}` }, conversation: { companyId } },
      orderBy: { createdAt: "desc" },
      select,
    });
  }

  private async resolveChatId(client: wppconnect.Whatsapp, phone: string): Promise<string> {
    const value = String(phone || "").trim();
    if (!value) {
      throw new AppError("Invalid WhatsApp destination", 400);
    }
    if (value.includes("@")) {
      return value;
    }
    const chatId = `${normalizePhone(value)}@c.us`;
    // acerta o 9º dígito e usa o LID quando o WhatsApp o fornece
    const found = await client.page
      .evaluate(async (id: string) => {
        type SerializableWid = { _serialized: string } | undefined;
        const { WPP } = globalThis as unknown as {
          WPP: { contact: { queryWidExists: (id: string) => Promise<{ wid: SerializableWid; lid?: SerializableWid } | null> } };
        };
        const result = await WPP.contact.queryWidExists(id);
        return result ? { wid: result.wid?._serialized ?? null, lid: result.lid?._serialized ?? null } : null;
      }, chatId)
      .catch((error: Error) => {
        logger.warn(`[WPPConnect] queryWidExists failed for ${chatId}: ${error.message}`);
        return undefined;
      });
    if (found === null) {
      throw new AppError("Este número não tem WhatsApp", 422);
    }
    return found?.lid || found?.wid || chatId;
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

  private getIncomingMediaType(message: any): string | null {
    const type = String(message.type || "");
    const mediaType = INCOMING_MEDIA_TYPES[type];
    if (mediaType) return mediaType;
    if (type !== "chat") {
      logger.info(`[WPPConnect] Unhandled incoming message type: ${type || "(empty)"}`);
    }
    return message.mediaKey || message.isMedia ? "document" : null;
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
    companyId: string,
  ): Promise<string | null> {
    let remoteUrl: string | null =
      message.sender?.profilePicThumbObj?.eurl ||
      message.sender?.profilePicThumbObj?.imgFull ||
      message.sender?.profilePicThumbObj?.img ||
      null;

    if (!remoteUrl && contactRemoteId) {
      const pic = await client.getProfilePicFromServer(contactRemoteId).catch(() => null);
      remoteUrl = pic?.eurl || pic?.imgFull || pic?.img || null;
    }

    return remoteUrl ? this.saveContactAvatar(remoteUrl, companyId) : null;
  }

  private async saveContactAvatar(remoteUrl: string, companyId: string): Promise<string | null> {
    try {
      const url = new URL(remoteUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".whatsapp.net")) return null;

      const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
      const mimeType = response.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
      if (!response.ok || !mimeType.startsWith("image/")) {
        await response.body?.cancel();
        return null;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.byteLength || buffer.byteLength > AVATAR_MAX_BYTES) return null;

      const saved = await saveMediaBuffer({
        buffer,
        directory: `avatars/${companyId}`,
        fileName: "avatar",
        mimeType,
      });
      return saved.url;
    } catch (error) {
      logger.warn(`[WPPConnect] Failed to save contact avatar: ${(error as Error).message}`);
      return null;
    }
  }

  private async resolveIncomingMedia(
    client: wppconnect.Whatsapp,
    message: any,
    companyId: string,
    mediaType: string,
  ): Promise<{
    mediaType: string;
    mediaUrl: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
  } | null> {
    try {
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
      include: { _count: { select: { integrations: { where: { type: "WHATSAPP", status: "ACTIVE" } } } } },
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
        provider: "WPPCONNECT",
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
      where: { id: integrationId, companyId, type: "WHATSAPP", provider: "WPPCONNECT" },
    });

    if (!integration) {
      throw new AppError("WhatsApp integration not found", 404);
    }

    return integration;
  }
}

// Singleton instance
export const wppConnectService = new WppConnectService();
