import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { generateSecretToken, hashSecretToken } from "../../utils/secret-token";
import { allowPrivateWebhooks, type UpdateAutomationConfigInput } from "./automation.schema";

export type AutomationEvent = "message.received" | "lead.created";

const WEBHOOK_TIMEOUT_MS = 5000;

const privateRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) privateRanges.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [["::", 127], ["fc00::", 7], ["fe80::", 10]] as const) {
  privateRanges.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family !== 0 && !privateRanges.check(address, family === 4 ? "ipv4" : "ipv6");
}

// shortcut: o fetch resolve o DNS de novo, então rebinding entre a checagem e a conexão passa; fixar o IP via dispatcher do undici se o webhook sair do plano interno.
async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every(({ address }) => isPublicAddress(address));
  } catch {
    return false;
  }
}

export async function publishEvent(companyId: string, event: AutomationEvent, data: object): Promise<boolean> {
  try {
    const config = await prisma.automationConfig.findUnique({
      where: { companyId },
      select: { webhookUrl: true },
    });
    if (!config?.webhookUrl) return false;
    if (!allowPrivateWebhooks && !(await resolvesToPublicAddress(new URL(config.webhookUrl).hostname))) {
      logger.warn("[Automations] Webhook aponta para rede interna", { companyId, event });
      return false;
    }
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, companyId, occurredAt: new Date().toISOString(), data }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      redirect: "error",
    });
    if (!response.ok) logger.warn("[Automations] Webhook respondeu com erro", { companyId, event, status: response.status });
    return response.ok;
  } catch (error) {
    logger.warn("[Automations] Falha ao enviar webhook", { companyId, event, error: String(error) });
    return false;
  }
}

export class AutomationService {
  async getConfig(companyId: string) {
    const config = await prisma.automationConfig.findUnique({ where: { companyId } });
    return { webhookUrl: config?.webhookUrl ?? null, hasApiKey: Boolean(config?.apiKeyHash) };
  }

  async updateConfig(companyId: string, { webhookUrl }: UpdateAutomationConfigInput) {
    await prisma.automationConfig.upsert({
      where: { companyId },
      create: { companyId, webhookUrl },
      update: { webhookUrl },
    });
    return this.getConfig(companyId);
  }

  async testWebhook(companyId: string) {
    const { webhookUrl } = await this.getConfig(companyId);
    if (!webhookUrl) throw new AppError("Cadastre a URL do webhook antes de testar", 422);
    const sent = await publishEvent(companyId, "message.received", { test: true, content: "Mensagem de teste do Zap2" });
    if (!sent) throw new AppError("O webhook não confirmou o recebimento (erro, timeout ou endereço interno)", 502);
    return { sent };
  }

  async rotateApiKey(companyId: string) {
    const apiKey = generateSecretToken("zap2");
    const apiKeyHash = hashSecretToken(apiKey);
    await prisma.automationConfig.upsert({
      where: { companyId },
      create: { companyId, apiKeyHash },
      update: { apiKeyHash },
    });
    return { apiKey };
  }

  async revokeApiKey(companyId: string) {
    await prisma.automationConfig.updateMany({ where: { companyId }, data: { apiKeyHash: null } });
    return this.getConfig(companyId);
  }

  async findCompanyIdByApiKey(apiKey: string | undefined): Promise<string> {
    const config = apiKey
      ? await prisma.automationConfig.findUnique({
        where: { apiKeyHash: hashSecretToken(apiKey) },
        select: { companyId: true, company: { select: { isActive: true } } },
      })
      : null;
    if (!config) throw new AppError("Chave de API inválida", 401);
    if (!config.company.isActive) throw new AppError("Company subscription is inactive. Contact support.", 403);
    return config.companyId;
  }
}
