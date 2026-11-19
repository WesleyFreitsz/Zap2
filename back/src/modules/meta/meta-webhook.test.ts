import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { parseMetaWebhook, verifyWebhookChallenge, verifyWebhookSignature } from "./meta-webhook";

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

test("parseia texto e mídia do WhatsApp, aceita from_user_id e ignora statuses", () => {
  const value = {
    metadata: { phone_number_id: "phone" },
    contacts: [
      { wa_id: "5511999999999", profile: { name: "Ana" } },
      { user_id: "user-2", profile: { name: "-" } },
    ],
    messages: [
      { id: "wa-1", from: "5511999999999", timestamp: "1700000000", type: "text", text: { body: "Olá" } },
      { id: "wa-2", from_user_id: "user-2", timestamp: "1700000000", type: "image", image: { id: "media" } },
      { id: "wa-3", type: "text" },
    ],
    statuses: [{ id: "sent-1", status: "delivered" }],
  };
  const wrap = (changeValue: unknown) => ({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: changeValue }] }],
  });

  assert.deepEqual(parseMetaWebhook(wrap(value)), [
    { channel: "WHATSAPP", accountId: "phone", contactRemoteId: "5511999999999", contactName: "Ana", externalId: "wa-1", content: "Olá", sentAt: new Date(1700000000000) },
    { channel: "WHATSAPP", accountId: "phone", contactRemoteId: "user-2", contactName: "-", externalId: "wa-2", content: "[image]", sentAt: new Date(1700000000000) },
  ]);
  assert.deepEqual(parseMetaWebhook(wrap({ metadata: value.metadata, statuses: value.statuses })), []);
});

for (const [object, channel] of [["page", "FACEBOOK"], ["instagram", "INSTAGRAM"]] as const) {
  test(`parseia ${channel} e ignora is_echo e eventos sem mensagem`, () => {
    const event = { sender: { id: "contact" }, recipient: { id: "account" }, timestamp: 1700000000000 };
    const messages = parseMetaWebhook({ object, entry: [{ id: "account", messaging: [
      { ...event, message: { mid: "text-1", text: "Oi" } },
      { ...event, message: { mid: "media-1", attachments: [{ type: "audio" }] } },
      { ...event, message: { mid: "echo", text: "Oi", is_echo: true } },
      { ...event, read: { watermark: 1700000000000 } },
    ] }] });
    const expected = { channel, accountId: "account", contactRemoteId: "contact", sentAt: new Date(event.timestamp) };
    assert.deepEqual(messages, [
      { ...expected, externalId: "text-1", content: "Oi" },
      { ...expected, externalId: "media-1", content: "[audio]" },
    ]);
  });
}
