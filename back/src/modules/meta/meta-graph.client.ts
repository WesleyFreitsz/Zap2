import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

const graphErrorSchema = z.object({
  error: z.object({ code: z.number().optional(), error_subcode: z.number().optional(), message: z.string().optional() }),
});

type GraphRequestOptions = {
  method?: "GET" | "POST";
  token?: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
};

export async function graphRequest(
  path: string,
  { body, method = body ? "POST" : "GET", token, query }: GraphRequestOptions = {},
): Promise<unknown> {
  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  let response: Response;
  let payload: unknown;
  try {
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body) headers.set("Content-Type", "application/json");
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    payload = await response.json();
  } catch {
    logger.warn("[Meta Graph] Falha na requisição ou resposta inválida");
    throw new AppError("Falha na comunicação com a Meta", 502);
  }

  const result = graphErrorSchema.safeParse(payload);
  if (result.success) {
    const { code, error_subcode, message } = result.data.error;
    let safeMessage = message ?? "";
    for (const secret of [token, env.META_APP_SECRET, query?.access_token, query?.fb_exchange_token, query?.client_secret, query?.code]) {
      if (secret) {
        safeMessage = safeMessage.replaceAll(secret, "[redacted]").replaceAll(encodeURIComponent(secret), "[redacted]");
      }
    }
    logger.warn("[Meta Graph] Requisição recusada", { code, error_subcode, message: safeMessage });
    if (code === 10 || code === 131047 || error_subcode === 2018278) {
      throw new AppError("Fora da janela de 24h: o cliente precisa mandar mensagem antes", 422);
    }
    throw new AppError("Falha na comunicação com a Meta", 502);
  }
  if (!response.ok) throw new AppError("Falha na comunicação com a Meta", 502);
  return payload;
}

const accessTokenSchema = z.object({ access_token: z.string().min(1) });
const graphId = z.string().regex(/^\d+$/);
const pageAccountsSchema = z.object({
  data: z.array(z.object({
    id: graphId,
    name: z.string(),
    access_token: z.string().min(1),
    instagram_business_account: z.object({
      id: graphId,
      username: z.string(),
    }).nullish(),
  })),
  paging: z.object({
    next: z.string().optional(),
    cursors: z.object({ after: z.string().min(1) }).optional(),
  }).optional(),
});
const phoneNumberSchema = z.object({
  display_phone_number: z.string().optional(),
  verified_name: z.string().optional(),
});
const graphSuccessSchema = z.object({ success: z.literal(true) });

export type MetaPage = z.infer<typeof pageAccountsSchema>["data"][number];

async function readGraphResponse<T>(
  schema: z.ZodType<T>,
  path: string,
  options: GraphRequestOptions,
): Promise<T> {
  const result = schema.safeParse(await graphRequest(path, options));
  if (!result.success) throw new AppError("Resposta inválida da Meta", 502);
  return result.data;
}

export async function exchangeMetaCode(code: string): Promise<string> {
  const { access_token } = await readGraphResponse(accessTokenSchema, "oauth/access_token", {
    query: { client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, code },
  });
  return access_token;
}

export async function exchangeMetaUserToken(token: string): Promise<string> {
  const { access_token } = await readGraphResponse(accessTokenSchema, "oauth/access_token", {
    query: {
      grant_type: "fb_exchange_token",
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      fb_exchange_token: token,
    },
  });
  return access_token;
}

export async function listMetaPages(token: string): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];
  const fields = "id,name,access_token,instagram_business_account{id,username}";
  let after: string | undefined;

  do {
    const result = await readGraphResponse(pageAccountsSchema, "me/accounts", {
      token,
      query: after ? { fields, after } : { fields },
    });
    pages.push(...result.data);
    const nextCursor = result.paging?.next ? result.paging.cursors?.after : undefined;
    if (result.paging?.next && (!nextCursor || nextCursor === after)) {
      throw new AppError("Paginação inválida da Meta", 502);
    }
    after = nextCursor;
  } while (after);

  return pages;
}

export async function subscribeMetaPage(pageId: string, token: string): Promise<void> {
  await readGraphResponse(graphSuccessSchema, `${pageId}/subscribed_apps`, {
    method: "POST",
    token,
    query: { subscribed_fields: "messages" },
  });
}

export async function subscribeMetaWhatsApp(wabaId: string, token: string): Promise<void> {
  await readGraphResponse(graphSuccessSchema, `${wabaId}/subscribed_apps`, { method: "POST", token });
}

export async function registerMetaWhatsApp(phoneNumberId: string, token: string, pin: string): Promise<void> {
  await readGraphResponse(graphSuccessSchema, `${phoneNumberId}/register`, {
    token,
    body: { messaging_product: "whatsapp", pin },
  });
}

export function readMetaPhoneNumber(phoneNumberId: string, token: string) {
  return readGraphResponse(phoneNumberSchema, phoneNumberId, {
    token,
    query: { fields: "display_phone_number,verified_name" },
  });
}
