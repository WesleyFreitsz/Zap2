import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

export type ZendeskCredentials = { subdomain: string; email: string; apiToken: string };

export type ZendeskComment = { id: number; public: boolean; author_id: number; plain_body: string };

const REQUEST_TIMEOUT_MS = 10000;

export async function zendeskRequest<Result>(
  { subdomain, email, apiToken }: ZendeskCredentials,
  path: string,
  init: { method?: string; body?: object } = {},
): Promise<Result> {
  let response: Response;
  try {
    response = await fetch(`https://${subdomain}.zendesk.com/api/v2${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${email}/token:${apiToken}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn("[Zendesk] Falha de rede", { path, error: String(error) });
    throw new AppError("Não foi possível falar com o Zendesk", 502);
  }
  if (response.status === 401 || response.status === 403) {
    throw new AppError("Credenciais do Zendesk inválidas", 422);
  }
  if (response.status === 404) {
    throw new AppError("Não encontrado no Zendesk (confira o subdomínio ou se o ticket foi apagado)", 404);
  }
  if (!response.ok) {
    logger.warn("[Zendesk] Resposta com erro", { path, status: response.status, body: await response.text() });
    throw new AppError("O Zendesk recusou a operação", 502);
  }
  return response.json() as Promise<Result>;
}
