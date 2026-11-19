import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { InboundMedia } from "./meta-webhook";

let downloadInboundMedia: typeof import("./meta-media").downloadInboundMedia;
before(async () => {
  process.env.JWT_SECRET ||= "test-secret";
  process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
  ({ downloadInboundMedia } = await import("./meta-media"));
});

function imageFromUrl(url: string): InboundMedia {
  return { kind: "image", source: { type: "url", url } };
}

test("baixa mídia dos CDNs permitidos por HTTPS sem enviar o token", async (t) => {
  const mockFetch = t.mock.method(globalThis, "fetch",
    async (_url: URL, options?: RequestInit) => {
      assert.equal(options?.headers, undefined);
      assert.equal(options?.redirect, "error");
      assert.ok(options?.signal);
      return new Response("abc", { headers: { "content-type": "image/jpeg; charset=binary" } });
    });
  for (const host of ["scontent.fbcdn.net", "www.facebook.com", "scontent.cdninstagram.com", "media.whatsapp.net"]) {
    const result = await downloadInboundMedia(imageFromUrl(`https://${host}/file`), "token");
    assert.equal(result.mimeType, "image/jpeg");
    assert.deepEqual(result.buffer, Buffer.from("abc"));
  }
  assert.equal(mockFetch.mock.callCount(), 4);
});

test("rejeita URLs fora da allowlist antes do fetch", async (t) => {
  const mockFetch = t.mock.method(globalThis, "fetch", async () => new Response("abc"));
  for (const url of [
    "http://scontent.fbcdn.net/file",
    "https://scontent.fbcdn.net.example.com/file",
    "https://badfbcdn.net/file",
    "https://127.0.0.1/file",
    "https://scontent.fbcdn.net:8443/file",
    "https://name:password@scontent.fbcdn.net/file",
    "https://lookaside.fbsbx.com/file",
  ]) {
    await assert.rejects(downloadInboundMedia(imageFromUrl(url)), /não permitida/);
  }
  assert.equal(mockFetch.mock.callCount(), 0);
});

test("consulta metadados e baixa mídia do WhatsApp com o mesmo Bearer e timeout", async (t) => {
  const downloadUrl = "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123";
  const mockFetch = t.mock.method(globalThis, "fetch", async (url: URL, options?: RequestInit) => {
    assert.deepEqual(options?.headers, { Authorization: "Bearer token" });
    assert.equal(options?.redirect, "error");
    if (url.hostname === "graph.facebook.com") {
      assert.match(url.pathname, /\/\d+$/);
      return Response.json({ url: downloadUrl, mime_type: "application/pdf", file_size: 3 });
    }
    assert.equal(url.href, downloadUrl);
    return new Response("abc");
  });
  const result = await downloadInboundMedia({
    kind: "document",
    source: { type: "whatsapp_media_id", id: "123" },
    fileName: "pedido.pdf",
  }, "token");
  assert.deepEqual(result, { buffer: Buffer.from("abc"), mimeType: "application/pdf", fileName: "pedido.pdf" });
  assert.equal(mockFetch.mock.callCount(), 2);
  const [lookup, download] = mockFetch.mock.calls;
  assert.ok(lookup.arguments[1]?.signal);
  assert.equal(lookup.arguments[1]?.signal, download.arguments[1]?.signal);
});

test("interrompe a leitura se o tamanho declarado ou real exceder 16 MB", async (t) => {
  const maxBytes = 16 * 1024 * 1024;
  const media = imageFromUrl("https://scontent.fbcdn.net/file");
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(maxBytes));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() { cancelled = true; },
  });
  const mockFetch = t.mock.method(globalThis, "fetch", async () => new Response(stream));
  mockFetch.mock.mockImplementationOnce(async () => new Response("abc", {
    headers: { "content-length": String(maxBytes + 1) },
  }));
  await assert.rejects(downloadInboundMedia(media), /limite de tamanho/);
  await assert.rejects(downloadInboundMedia(media), /limite de tamanho/);
  assert.equal(cancelled, true);
});
