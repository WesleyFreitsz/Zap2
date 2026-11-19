import assert from "node:assert/strict";
import test from "node:test";
import { buildTemplatePayload, renderTemplateBody, toTemplateSummary } from "./whatsapp-templates";

const approved = { name: "pedido", language: "pt_BR", category: "UTILITY", status: "APPROVED" };

test("resume os componentes estáticos e ordena parâmetros posicionais pelo índice de envio", () => {
  const summary = toTemplateSummary({
    ...approved,
    components: [
      { type: "HEADER", format: "TEXT", text: "Pedido" },
      { type: "BODY", text: "{{2}} para {{1}} ({{2}})" },
      { type: "FOOTER", text: "Atendimento" },
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Consultar", url: "https://example.com/pedidos" }] },
    ],
  });
  assert.deepEqual(summary, {
    name: "pedido",
    language: "pt_BR",
    category: "UTILITY",
    format: "POSITIONAL",
    header: "Pedido",
    body: "{{2}} para {{1}} ({{2}})",
    footer: "Atendimento",
    buttons: ["Consultar"],
    variables: ["2", "1"],
  });
  assert.ok(summary);
  const values = { "1": "Ana", "2": "Pedido 30" };
  assert.deepEqual(buildTemplatePayload(summary, values), {
    name: "pedido",
    language: { code: "pt_BR" },
    components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "Pedido 30" }] }],
  });
  assert.equal(renderTemplateBody(summary, values), "Pedido 30 para Ana (Pedido 30)");
});

test("envia parâmetros nomeados e exige valor para cada variável", () => {
  const summary = toTemplateSummary({
    ...approved,
    parameter_format: "NAMED",
    components: [{ type: "BODY", text: "Olá, {{first_name}}" }],
  });
  assert.ok(summary);
  assert.deepEqual(summary.variables, ["first_name"]);
  assert.deepEqual(buildTemplatePayload(summary, { first_name: "Ana" }), {
    name: "pedido",
    language: { code: "pt_BR" },
    components: [{ type: "body", parameters: [{ type: "text", text: "Ana", parameter_name: "first_name" }] }],
  });
  assert.throws(() => buildTemplatePayload(summary, {}), { statusCode: 422, message: "Preencha a variável {{first_name}}" });
  assert.throws(() => renderTemplateBody(summary, { first_name: " " }), { statusCode: 422 });
});

test("omite componentes no payload sem variáveis", () => {
  const summary = toTemplateSummary({ ...approved, components: [{ type: "BODY", text: "Pedido recebido" }] });
  assert.ok(summary);
  assert.deepEqual(buildTemplatePayload(summary, {}), { name: "pedido", language: { code: "pt_BR" } });
});

test("filtra cabeçalho de mídia, variáveis fora do corpo e templates inelegíveis", () => {
  const body = { type: "BODY", text: "Pedido recebido" };
  for (const component of [
    { type: "HEADER", format: "IMAGE" },
    { type: "HEADER", format: "TEXT", text: "Pedido {{1}}" },
    { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver", url: "https://example.com/{{1}}" }] },
    { type: "BUTTONS", buttons: [{ type: "COPY_CODE", text: "Copiar" }] },
  ]) {
    assert.equal(toTemplateSummary({ ...approved, components: [body, component] }), null);
  }
  assert.equal(toTemplateSummary({ ...approved, status: "PENDING", components: [body] }), null);
  assert.equal(toTemplateSummary({ ...approved, category: "AUTHENTICATION", components: [body] }), null);
});
