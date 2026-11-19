import { randomInt, randomUUID } from "node:crypto";
import { Prisma, type IntegrationType } from "@prisma/client";
import { env } from "../../config/env";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { encryptSecret, hasTokenEncryptionKey } from "../../utils/crypto";
import { logger } from "../../utils/logger";
import { wppConnectService } from "../integrations/wppconnect/wppconnect.service";
import {
  exchangeMetaCode,
  exchangeMetaUserToken,
  listMetaPages,
  readMetaPhoneNumber,
  registerMetaWhatsApp,
  subscribeMetaPage,
  subscribeMetaWhatsApp,
  type MetaPage,
} from "../meta/meta-graph.client";
import type { ConnectPagesInput, ConnectWhatsAppInput, ManualConnectInput } from "./channels.schema";

const discoveryTtl = 10 * 60 * 1000;
const channelSelect = {
  id: true,
  type: true,
  provider: true,
  label: true,
  instanceName: true,
  externalAccountId: true,
  connectionStatus: true,
  status: true,
  createdAt: true,
} satisfies Prisma.IntegrationSelect;

type ChannelRow = Prisma.IntegrationGetPayload<{ select: typeof channelSelect }>;
type MetaChannel = {
  type: IntegrationType;
  externalAccountId: string;
  label?: string;
  metaPageId?: string;
  wabaId?: string;
};

function toChannel({ instanceName, ...channel }: ChannelRow) {
  return { ...channel, label: channel.label ?? instanceName };
}

function accountConflict() {
  return new AppError("Conta já vinculada a outra empresa", 409);
}

async function checkMetaChannels(
  db: Prisma.TransactionClient,
  companyId: string,
  channels: MetaChannel[],
) {
  const accounts = await db.integration.findMany({
    where: { OR: channels.map(({ type, externalAccountId }) => ({ type, externalAccountId })) },
    select: { companyId: true, type: true },
  });

  if (accounts.some((account) => account.companyId !== companyId)) throw accountConflict();
  if (!channels.some(({ type }) => type === "WHATSAPP") || accounts.some(({ type }) => type === "WHATSAPP")) {
    return;
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      plan: true,
      _count: { select: { integrations: { where: { type: "WHATSAPP" } } } },
    },
  });
  if (!company) throw new AppError("Empresa não encontrada", 404);

  const plan = await db.plan.findFirst({ where: { slug: company.plan, isActive: true } });
  if (plan && company._count.integrations >= plan.maxNumbers) {
    throw new AppError(
      `Limite do plano atingido: máximo de ${plan.maxNumbers} número(s) WhatsApp no plano ${plan.name}`,
      403,
    );
  }
}

async function saveMetaChannels(companyId: string, channels: MetaChannel[], accessToken: string) {
  const accessTokenEncrypted = encryptSecret(accessToken, env.TOKEN_ENCRYPTION_KEY);
  const connection = {
    provider: "META",
    status: "ACTIVE",
    connectionStatus: "CONNECTED",
    connectedAt: new Date(),
    token: "",
    accessTokenEncrypted,
  } as const;

  for (let attempt = 1; ; attempt++) {
    try {
      const rows = await prisma.$transaction(async (tx) => {
        await checkMetaChannels(tx, companyId, channels);

        return Promise.all(channels.map(({ type, externalAccountId, label, metaPageId, wabaId }) =>
          tx.integration.upsert({
            where: { type_externalAccountId: { type, externalAccountId }, companyId },
            create: { ...connection, companyId, type, externalAccountId, label, metaPageId, wabaId },
            update: { ...connection, label, metaPageId, wabaId },
            select: channelSelect,
          }),
        ));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return rows.map(toChannel);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
      if (attempt < 3 && (error.code === "P2034" || error.code === "P2002")) continue;
      if (error.code === "P2002") throw accountConflict();
      if (error.code === "P2034") throw new AppError("Conexão concorrente. Tente novamente.", 409);
      throw error;
    }
  }
}

export class ChannelsService {
  // shortcut: cache local a uma instância, mover para armazenamento compartilhado ao escalar.
  private readonly discoveries = new Map<string, { companyId: string; expiresAt: number; pages: MetaPage[] }>();

  async findAll(companyId: string) {
    const rows = await prisma.integration.findMany({
      where: { companyId, NOT: { provider: "META", status: "INACTIVE" } },
      select: channelSelect,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toChannel);
  }

  getMetaConfig() {
    return {
      enabled: Boolean(env.META_APP_ID.trim() && env.META_APP_SECRET.trim() && hasTokenEncryptionKey(env.TOKEN_ENCRYPTION_KEY)),
      manualConnect: env.META_ALLOW_MANUAL_CONNECT,
    };
  }

  private requireMetaConfig() {
    if (!this.getMetaConfig().enabled) throw new AppError("Integração Meta não configurada", 503);
  }

  async discoverPages(companyId: string, code: string) {
    this.requireMetaConfig();
    const userToken = await exchangeMetaCode(code);
    const pages = await listMetaPages(await exchangeMetaUserToken(userToken));
    const discoveryId = randomUUID();
    this.discoveries.set(discoveryId, { companyId, pages, expiresAt: Date.now() + discoveryTtl });
    setTimeout(() => this.discoveries.delete(discoveryId), discoveryTtl).unref();

    return {
      discoveryId,
      pages: pages.map(({ id, name, instagram_business_account }) => ({
        id,
        name,
        instagram: instagram_business_account ?? null,
      })),
    };
  }

  async connectPages(companyId: string, input: ConnectPagesInput) {
    this.requireMetaConfig();
    const discovery = this.discoveries.get(input.discoveryId);
    if (!discovery || discovery.companyId !== companyId || discovery.expiresAt <= Date.now()) {
      throw new AppError("Descoberta de páginas inválida ou expirada", 404);
    }

    const page = discovery.pages.find(({ id }) => id === input.pageId);
    if (!page) throw new AppError("Página não encontrada", 404);

    const channels = Array.from(new Set(input.channels), (type): MetaChannel => {
      if (type === "FACEBOOK") return { type, externalAccountId: page.id, label: page.name };

      const instagram = page.instagram_business_account;
      if (!instagram) throw new AppError("Página sem conta profissional do Instagram", 422);
      return { type, externalAccountId: instagram.id, label: instagram.username, metaPageId: page.id };
    });

    await checkMetaChannels(prisma, companyId, channels);
    await subscribeMetaPage(page.id, page.access_token);
    return saveMetaChannels(companyId, channels, page.access_token);
  }

  async connectWhatsApp(companyId: string, { code, wabaId, phoneNumberId }: ConnectWhatsAppInput) {
    this.requireMetaConfig();
    const channel: MetaChannel = { type: "WHATSAPP", externalAccountId: phoneNumberId, wabaId };
    await checkMetaChannels(prisma, companyId, [channel]);

    const accessToken = await exchangeMetaCode(code);
    await subscribeMetaWhatsApp(wabaId, accessToken);
    try {
      const pin = String(randomInt(1_000_000)).padStart(6, "0");
      await registerMetaWhatsApp(phoneNumberId, accessToken, pin);
    } catch {
      logger.warn("[Meta] Registro do número WhatsApp não confirmado", { phoneNumberId });
    }
    const { display_phone_number, verified_name } = await readMetaPhoneNumber(phoneNumberId, accessToken);
    channel.label = display_phone_number || verified_name || phoneNumberId;

    const [saved] = await saveMetaChannels(companyId, [channel], accessToken);
    return saved;
  }

  async connectManual(companyId: string, { accessToken, ...channel }: ManualConnectInput) {
    const [saved] = await saveMetaChannels(companyId, [channel], accessToken);
    return saved;
  }

  async delete(companyId: string, id: string) {
    const integration = await prisma.integration.findFirst({
      where: { id, companyId },
      select: { provider: true, type: true },
    });
    if (!integration) throw new AppError("Canal não encontrado", 404);

    if (integration.provider === "META") {
      // desativa em vez de apagar: as conversas mantêm o vínculo e nada sai por outro número
      await prisma.integration.updateMany({
        where: { id, companyId },
        data: { status: "INACTIVE", connectionStatus: "DISCONNECTED", accessTokenEncrypted: null },
      });
      return { message: "Canal desconectado" };
    }

    if (integration.type === "WHATSAPP") {
      await wppConnectService.disconnect(id, companyId);
    }
    await prisma.integration.deleteMany({ where: { id, companyId } });
    return { message: "Canal removido" };
  }
}
