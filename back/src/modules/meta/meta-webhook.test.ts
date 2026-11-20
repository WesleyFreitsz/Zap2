import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { parseMetaEvents, parseMetaWebhook, verifyWebhookChallenge, verifyWebhookSignature } from "./meta-webhook";

test("verifica o token e devolve o challenge original", () => {
  const query = { "hub.mode": "subscribe", "hub.verify_token": "verify", "hub.challenge": "001" };
  assert.equal(verifyWebhookChallenge(query, "verify"), "001");
  assert.equal(verifyWebhookChallenge(query, "wrong"), undefined);
});

test("confere a assinatura com os bytes originais e rejeita mudanças ou assinatura truncada", () => {
  const secret = "test-secret";
  const body = Buffer.from('{ "object": "page" }');
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  assert.equal(verifyWebhookSignature(body, signature, secret), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"object":"page"}'), signature, secret), false);
  assert.equal(verifyWebhookSignature(body, signature.slice(0, -1), secret), false);
  assert.equal(verifyWebhookSignature(body, undefined, secret), false);
});

test("parseia texto e mídia do WhatsApp, aceita from_user_id e não vira mensagem o status nem a reação", () => {
  const value = {
    metadata: { phone_number_id: "phone" },
    contacts: [
      { wa_id: "5511999999999", profile: { name: "Ana" } },
      { user_id: "user-2", profile: { name: "-" } },
    ],
    messages: [
      { id: "wa-1", from: "5511999999999", timestamp: "1700000000", type: "text", text: { body: "Olá" } },
      { id: "wa-2", from_user_id: "user-2", timestamp: "1700000000", type: "document", document: { id: "media", mime_type: "application/pdf", filename: "pedido.pdf", caption: "Pedido" } },
      { id: "wa-4", from_user_id: "user-2", timestamp: "1700000000", type: "sticker", sticker: { id: "sticker", mime_type: "image/webp" } },
      { id: "wa-3", type: "text" },
      { id: "wa-5", from: "5511999999999", timestamp: "1700000000", type: "reaction", reaction: { message_id: "sent-1", emoji: "👍" } },
    ],
    statuses: [{ id: "sent-1", status: "delivered" }],
  };
  const wrap = (changeValue: unknown) => ({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: changeValue }] }],
  });

  assert.deepEqual(parseMetaWebhook(wrap(value)), [
    { channel: "WHATSAPP", accountId: "phone", contactRemoteId: "5511999999999", contactName: "Ana", externalId: "wa-1", content: "Olá", sentAt: new Date(1700000000000) },
    {
      channel: "WHATSAPP", accountId: "phone", contactRemoteId: "user-2", contactName: "-", externalId: "wa-2",
      content: "Pedido", sentAt: new Date(1700000000000),
      media: { kind: "document", source: { type: "whatsapp_media_id", id: "media" }, mimeType: "application/pdf", fileName: "pedido.pdf", caption: "Pedido" },
    },
    {
      channel: "WHATSAPP", accountId: "phone", contactRemoteId: "user-2", contactName: "-", externalId: "wa-4",
      content: "[figurinha]", sentAt: new Date(1700000000000),
      media: { kind: "sticker", source: { type: "whatsapp_media_id", id: "sticker" }, mimeType: "image/webp", fileName: undefined, caption: undefined },
    },
  ]);
  assert.deepEqual(parseMetaWebhook(wrap({ metadata: value.metadata, statuses: value.statuses })), []);
});

for (const [object, channel] of [["page", "FACEBOOK"], ["instagram", "INSTAGRAM"]] as const) {
  test(`parseia ${channel} e ignora is_echo e eventos sem mensagem`, () => {
    const event = { sender: { id: "contact" }, recipient: { id: "account" }, timestamp: 1700000000000 };
    const url = "https://media.fbcdn.net/pedido.pdf";
    const messages = parseMetaWebhook({ object, entry: [{ id: "account", messaging: [
      { ...event, message: { mid: "text-1", text: "Oi" } },
      { ...event, message: { mid: "media-1", text: "Pedido", attachments: [{ type: "file", payload: { url } }, { type: "image", payload: { url: "https://media.fbcdn.net/foto.png" } }] } },
      { ...event, message: { mid: "media-2", attachments: [{ type: "audio" }] } },
      { ...event, message: { mid: "echo", text: "Oi", is_echo: true } },
      { ...event, read: { watermark: 1700000000000 } },
    ] }] });
    const expected = { channel, accountId: "account", contactRemoteId: "contact", sentAt: new Date(event.timestamp) };
    assert.deepEqual(messages, [
      { ...expected, externalId: "text-1", content: "Oi" },
      { ...expected, externalId: "media-1", content: "Pedido", media: { kind: "document", source: { type: "url", url } } },
      { ...expected, externalId: "media-2", content: "[áudio]" },
    ]);
  });
}

test("extrai status e reações do WhatsApp", () => {
  const events = parseMetaEvents({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: "phone" },
      statuses: [{ id: "sent-1", status: "delivered" }, { id: "sent-2", status: "read" }, { id: "sent-3", status: "deleted" }],
      messages: [
        { id: "r-1", from: "5511", timestamp: "1700000000", type: "reaction", reaction: { message_id: "sent-1", emoji: "👍" } },
        { id: "r-2", from: "5511", timestamp: "1700000000", type: "reaction", reaction: { message_id: "sent-2", emoji: "" } },
        { id: "wa-1", from: "5511", timestamp: "1700000000", type: "text", text: { body: "Olá" } },
      ],
    } }] }],
  });
  const account = { channel: "WHATSAPP", accountId: "phone" };
  assert.deepEqual(events, [
    { ...account, kind: "status", externalId: "sent-1", status: "DELIVERED" },
    { ...account, kind: "status", externalId: "sent-2", status: "READ" },
    { ...account, kind: "reaction", externalId: "sent-1", emoji: "👍" },
    { ...account, kind: "reaction", externalId: "sent-2", emoji: null },
  ]);
});

test("extrai leitura, entrega e reação do Messenger", () => {
  const event = { sender: { id: "contact" }, recipient: { id: "account" }, timestamp: 1700000000000 };
  const events = parseMetaEvents({ object: "page", entry: [{ id: "account", messaging: [
    { ...event, read: { watermark: 1700000000000 } },
    { ...event, delivery: { mids: ["mid-1"], watermark: 1700000000000 } },
    { ...event, reaction: { mid: "mid-1", action: "react", emoji: "❤️" } },
    { ...event, reaction: { mid: "mid-2", action: "unreact" } },
    { ...event, message: { mid: "text-1", text: "Oi" } },
  ] }] });
  const account = { channel: "FACEBOOK", accountId: "account" };
  assert.deepEqual(events, [
    { ...account, kind: "read", contactRemoteId: "contact", watermark: new Date(1700000000000) },
    { ...account, kind: "status", externalId: "mid-1", status: "DELIVERED" },
    { ...account, kind: "reaction", externalId: "mid-1", emoji: "❤️" },
    { ...account, kind: "reaction", externalId: "mid-2", emoji: null },
  ]);
});
