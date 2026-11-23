import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET ||= "test-jwt";
process.env.JWT_REFRESH_SECRET ||= "test-refresh";

test("entrega só respostas públicas de agentes ainda não enviadas, em ordem", async () => {
  const { selectPendingAgentComments } = await import("./zendesk.service");
  const comments = [
    { id: 30, public: true, author_id: 7, plain_body: "terceira" },
    { id: 25, public: false, author_id: 7, plain_body: "nota interna" },
    { id: 20, public: true, author_id: 99, plain_body: "do cliente" },
    { id: 18, public: true, author_id: 55, plain_body: "de quem está em cópia" },
    { id: 15, public: true, author_id: 7, plain_body: "segunda" },
    { id: 10, public: true, author_id: 7, plain_body: "já entregue" },
  ];
  assert.deepEqual(selectPendingAgentComments(comments, new Set([7]), "10").map((c) => c.plain_body), ["segunda", "terceira"]);
  assert.equal(selectPendingAgentComments(comments, new Set([7]), null).length, 3);
});

test("monta a transcrição com remetente e mídia", async () => {
  const { formatTranscript } = await import("./zendesk.service");
  const text = formatTranscript([
    { sender: "CLIENT", content: "Oi", mediaUrl: null, createdAt: new Date("2026-11-20T12:00:00Z") },
    { sender: "USER", content: "", mediaUrl: "https://cdn/x.jpg", createdAt: new Date("2026-11-20T12:01:00Z") },
  ]);
  assert.match(text, /Cliente: Oi/);
  assert.match(text, /Atendente: \[mídia: https:\/\/cdn\/x\.jpg\]/);
});

test("aceita só URL https pública para o webhook de automação", async () => {
  const { isAllowedWebhookUrl } = await import("../automations/automation.schema");
  assert.ok(isAllowedWebhookUrl("https://hooks.zapier.com/hooks/catch/1/abc"));
  assert.ok(isAllowedWebhookUrl("https://n8n.empresa.com.br/webhook/zap2"));
  assert.ok(!isAllowedWebhookUrl("http://n8n.empresa.com.br/webhook"));
  assert.ok(!isAllowedWebhookUrl("https://localhost/webhook"));
  assert.ok(!isAllowedWebhookUrl("https://169.254.169.254/latest"));
  assert.ok(!isAllowedWebhookUrl("https://[::1]/x"));
  assert.ok(isAllowedWebhookUrl("http://localhost:5678/webhook", true));
});

test("só considera pública a resolução DNS fora de redes internas", async () => {
  const { isPublicAddress } = await import("../automations/automation.service");
  assert.ok(isPublicAddress("8.8.8.8"));
  assert.ok(isPublicAddress("2606:4700::1111"));
  for (const address of ["10.0.0.5", "127.0.0.1", "169.254.169.254", "192.168.1.1", "172.20.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
    assert.ok(!isPublicAddress(address), address);
  }
});
