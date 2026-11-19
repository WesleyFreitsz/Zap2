import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionOptions = {
  maxTokens: number;
  temperature: number;
};

type GroqChatCompletion = {
  choices?: { message?: { content?: string | null } }[];
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 20_000;

export async function createChatCompletion(
  messages: ChatMessage[],
  { maxTokens, temperature }: ChatCompletionOptions,
): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new AppError("IA não configurada no servidor", 503);
  }

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages,
        max_completion_tokens: maxTokens,
        temperature,
        ...(env.GROQ_MODEL.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    logger.error(`[Groq] Request failed: ${(error as Error).message}`);
    throw new AppError("A IA não respondeu a tempo. Tente de novo.", 504);
  }

  if (response.status === 429) {
    throw new AppError("Limite de uso da IA atingido. Tente de novo em instantes.", 429);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    logger.error(`[Groq] HTTP ${response.status}: ${detail}`);
    throw new AppError("Falha ao gerar sugestão com a IA", 502);
  }

  const completion = (await response.json()) as GroqChatCompletion;
  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new AppError("A IA não retornou uma sugestão", 502);
  }

  return content;
}
