import type { ChatMessage } from "../ai-config/groq.client";

export type SuggestionMessage = {
  sender: "CLIENT" | "USER" | "SYSTEM";
  content: string;
};

export type SuggestionProduct = {
  name: string;
  code: string | null;
  description: string | null;
  price: number;
  promotionalPrice: number | null;
  stock: number;
};

export type SuggestionContext = {
  companyName: string;
  personality: string;
  language: string;
  systemPrompt: string | null;
  productContext: string | null;
  products: SuggestionProduct[];
  messages: SuggestionMessage[];
};

const TONES: Record<string, string> = {
  friendly: "amigável e próximo",
  formal: "formal e cordial",
  professional: "profissional e cordial",
  technical: "técnico e detalhista",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatProduct(product: SuggestionProduct): string {
  const price = product.promotionalPrice
    ? `${currency.format(product.promotionalPrice)} (de ${currency.format(product.price)})`
    : currency.format(product.price);
  const code = product.code ? ` [${product.code}]` : "";
  const description = product.description ? ` | ${product.description.slice(0, 120)}` : "";
  return `- ${product.name}${code}: ${price} | estoque: ${product.stock}${description}`;
}

function formatTranscript(messages: SuggestionMessage[]): string {
  return messages
    .filter((message) => message.sender !== "SYSTEM" && message.content.trim())
    .map((message) => `${message.sender === "CLIENT" ? "Cliente" : "Atendente"}: ${message.content.trim()}`)
    .join("\n");
}

export function buildReplySuggestionPrompt(context: SuggestionContext): ChatMessage[] {
  const tone = TONES[context.personality] ?? context.personality;
  const catalog = context.products.length
    ? context.products.map(formatProduct).join("\n")
    : "Nenhum produto cadastrado.";

  const system = [
    `Você ajuda um atendente da empresa "${context.companyName}" a responder clientes por mensagem.`,
    `Escreva UMA resposta curta, pronta para enviar, no idioma ${context.language}, com tom ${tone}.`,
    "Regras:",
    "- Use somente as informações do negócio e do catálogo abaixo.",
    "- Nunca invente preço, estoque, frete, prazo, desconto, forma de pagamento ou política.",
    "- Se o cliente pedir algo que não está nas informações, diga que vai verificar e já retorna.",
    "- Responda só com o texto da mensagem: sem aspas, sem prefixo e sem explicações.",
    context.systemPrompt?.trim() ? `Instruções da empresa:\n${context.systemPrompt.trim()}` : "",
    `Informações do negócio:\n${context.productContext?.trim() || "Nenhuma."}`,
    `Catálogo:\n${catalog}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `Conversa (da mais antiga para a mais recente):\n${formatTranscript(context.messages)}\n\nEscreva a próxima resposta do atendente.`,
    },
  ];
}
