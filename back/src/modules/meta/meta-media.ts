import { z } from "zod";
import { env } from "../../config/env";
import type { InboundMedia } from "./meta-webhook";

const maxMediaBytes = 16 * 1024 * 1024;
const cdnSuffixes = [".fbcdn.net", ".facebook.com", ".cdninstagram.com", ".whatsapp.net"];
const mediaMetadataSchema = z.object({
  url: z.string(),
  mime_type: z.string().min(1).optional(),
  file_size: z.number().int().nonnegative().optional(),
});

function validateMediaUrl(value: string, whatsapp: boolean): URL {
  const url = new URL(value);
  const allowedHost = cdnSuffixes.some((suffix) => url.hostname.endsWith(suffix)) ||
    (whatsapp && url.hostname === "lookaside.fbsbx.com");
  if (url.protocol !== "https:" || !allowedHost || url.port || url.username || url.password) {
    throw new Error("URL de mídia da Meta não permitida");
  }
  return url;
}

async function fetchMedia(url: URL, signal: AbortSignal, token?: string): Promise<Response> {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    redirect: "error",
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Falha ao baixar mídia da Meta (HTTP ${response.status})`);
  }
  return response;
}

async function readBuffer(response: Response, maxBytes: number): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error("Mídia da Meta excede o limite de tamanho");
  }
  if (!response.body) throw new Error("Resposta de mídia da Meta sem corpo");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Mídia da Meta excede o limite de tamanho");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error("Resposta de mídia da Meta sem corpo");
  return Buffer.concat(chunks, size);
}

export async function downloadInboundMedia({ source, mimeType, fileName }: InboundMedia, token?: string) {
  const signal = AbortSignal.timeout(20_000);
  let url: URL;
  let downloadToken: string | undefined;
  if (source.type === "whatsapp_media_id") {
    if (!token || !/^[\w-]+$/.test(source.id)) throw new Error("Dados de mídia do WhatsApp inválidos");
    const graphUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${source.id}`);
    const response = await fetchMedia(graphUrl, signal, token);
    const metadata = mediaMetadataSchema.parse(JSON.parse((await readBuffer(response, 64 * 1024)).toString("utf8")));
    if (metadata.file_size !== undefined && metadata.file_size > maxMediaBytes) {
      throw new Error("Mídia da Meta excede o limite de tamanho");
    }
    url = validateMediaUrl(metadata.url, true);
    mimeType = metadata.mime_type ?? mimeType;
    downloadToken = token;
  } else {
    url = validateMediaUrl(source.url, false);
  }

  const response = await fetchMedia(url, signal, downloadToken);
  const resolvedMimeType = (mimeType ?? response.headers.get("content-type"))?.split(";", 1)[0].trim().toLowerCase();
  return { buffer: await readBuffer(response, maxMediaBytes), mimeType: resolvedMimeType || "application/octet-stream", fileName };
}
