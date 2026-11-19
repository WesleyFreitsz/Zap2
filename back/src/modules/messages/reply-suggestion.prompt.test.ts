import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReplySuggestionPrompt, type SuggestionContext } from "./reply-suggestion.prompt";

const baseContext: SuggestionContext = {
  companyName: "Loja Teste",
  personality: "friendly",
  language: "pt-BR",
  systemPrompt: null,
  productContext: "Frete para o Sul: R$ 15.",
  products: [
    { name: "Moletom", code: "MOL-002", description: null, price: 189.9, promotionalPrice: 159.9, stock: 4 },
  ],
  messages: [
    { sender: "CLIENT", content: "Tem moletom?" },
    { sender: "SYSTEM", content: "Conversation transferred to Bruno" },
    { sender: "USER", content: "Tem sim!" },
  ],
};

test("system prompt carries the anti-invention rule, business info and catalog", () => {
  const [system] = buildReplySuggestionPrompt(baseContext);
  assert.equal(system.role, "system");
  assert.match(system.content, /Nunca invente preço/);
  assert.match(system.content, /Frete para o Sul: R\$ 15\./);
  assert.match(system.content, /Moletom \[MOL-002\]: R\$\s159,90 \(de R\$\s189,90\) \| estoque: 4/);
  assert.match(system.content, /tom amigável e próximo/);
  assert.doesNotMatch(system.content, /Instruções da empresa/);
});

test("transcript keeps client and attendant turns and drops system notices", () => {
  const [, user] = buildReplySuggestionPrompt(baseContext);
  assert.match(user.content, /Cliente: Tem moletom\?\nAtendente: Tem sim!/);
  assert.doesNotMatch(user.content, /transferred/);
});

test("empty catalog and custom instructions are stated explicitly", () => {
  const [system] = buildReplySuggestionPrompt({
    ...baseContext,
    products: [],
    systemPrompt: "Sempre chame o cliente pelo nome.",
  });
  assert.match(system.content, /Nenhum produto cadastrado\./);
  assert.match(system.content, /Instruções da empresa:\nSempre chame o cliente pelo nome\./);
});
