import assert from "node:assert/strict";
import test from "node:test";
import type { Message } from "@prisma/client";
import { canEditMessage, EDIT_WINDOW_MS, getWhatsAppChatId, getWhatsAppMessageKey, presentMessage } from "./message-rules";

test("extrai a chave da mensagem do WhatsApp independente de @lid ou @c.us", () => {
  assert.equal(getWhatsAppMessageKey("true_5511999999999@c.us_3EB0ABC"), "3EB0ABC");
  assert.equal(getWhatsAppMessageKey("false_123456789@lid_3EB0ABC"), "3EB0ABC");
  assert.equal(getWhatsAppMessageKey("true_5511999999999@c.us_3EB0ABC_out"), "3EB0ABC");
  assert.equal(getWhatsAppMessageKey("3EB0ABC"), "3EB0ABC");
  assert.equal(getWhatsAppMessageKey("5511999999999@c.us"), null);
  assert.equal(getWhatsAppMessageKey(""), null);
});

test("só permite editar mensagem do USER, não apagada e dentro de 15 minutos", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const createdAt = new Date(now.getTime() - EDIT_WINDOW_MS);
  assert.equal(canEditMessage({ sender: "USER", deletedAt: null, createdAt }, now), true);
  assert.equal(canEditMessage({ sender: "USER", deletedAt: null, createdAt: new Date(createdAt.getTime() - 1) }, now), false);
  assert.equal(canEditMessage({ sender: "CLIENT", deletedAt: null, createdAt: now }, now), false);
  assert.equal(canEditMessage({ sender: "USER", deletedAt: now, createdAt: now }, now), false);
});

test("mensagem apagada sai sem conteúdo e sem mídia, e a citação vem resumida", () => {
  const base = {
    id: "m1",
    conversationId: "c1",
    sender: "USER",
    content: "segredo",
    externalId: null,
    mediaType: "image",
    mediaUrl: "/uploads/x.jpg",
    mimeType: "image/jpeg",
    fileName: "x.jpg",
    fileSize: 10,
    status: null,
    reaction: null,
    replyToId: "m0",
    editedAt: null,
    deletedAt: new Date(),
    createdAt: new Date(),
  } as Message;
  const quoted = { id: "m0", content: "oi", sender: "CLIENT", mediaType: null, deletedAt: null } as const;

  const result = presentMessage({ ...base, replyTo: quoted });
  assert.equal(result.content, "");
  assert.equal(result.mediaUrl, null);
  assert.equal(result.fileName, null);
  assert.deepEqual(result.replyTo, { id: "m0", content: "oi", sender: "CLIENT", mediaType: null });

  const visible = presentMessage({ ...base, deletedAt: null });
  assert.equal(visible.content, "segredo");
  assert.equal(visible.replyTo, null);
});

test("extrai o chat do externalId do WhatsApp", () => {
  assert.equal(getWhatsAppChatId("true_23704511717525@lid_3EB00B1781DB4D748384A1"), "23704511717525@lid");
  assert.equal(getWhatsAppChatId("false_5543999252445@c.us_ABC_out"), "5543999252445@c.us");
  assert.equal(getWhatsAppChatId("wamid.HBgM"), null);
});
